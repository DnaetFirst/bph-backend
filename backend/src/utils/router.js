function normalizePath(path) {
  if (!path || path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function matchRoutePath(pattern, requestPath) {
  const normalizedPattern = normalizePath(pattern);
  const normalizedRequestPath = normalizePath(requestPath);

  if (normalizedPattern === '/') {
    return normalizedRequestPath === '/' ? { params: {} } : null;
  }

  const patternParts = normalizedPattern.split('/').filter(Boolean);
  const requestParts = normalizedRequestPath.split('/').filter(Boolean);

  if (patternParts.length !== requestParts.length) {
    return null;
  }

  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const requestPart = requestParts[index];

    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = decodeURIComponent(requestPart);
    } else if (patternPart !== requestPart) {
      return null;
    }
  }

  return { params };
}

function matchMountPath(pattern, requestPath) {
  const normalizedPattern = normalizePath(pattern);
  const normalizedRequestPath = normalizePath(requestPath);

  if (normalizedPattern === '/') {
    return { remainingPath: normalizedRequestPath };
  }

  if (normalizedRequestPath === normalizedPattern || normalizedRequestPath.startsWith(`${normalizedPattern}/`)) {
    const remainingPath = normalizedRequestPath === normalizedPattern
      ? '/'
      : normalizedRequestPath.slice(normalizedPattern.length) || '/';
    return { remainingPath };
  }

  return null;
}

/** Detecta si un handler es un error handler (4 parámetros: err, req, res, next). */
function isErrorHandler(fn) {
  return typeof fn === 'function' && fn.length === 4;
}

async function invokeHandler(handler, req, res, nextHandler) {
  if (typeof handler === 'function') {
    return handler(req, res, nextHandler);
  }

  if (handler && typeof handler.handle === 'function') {
    return handler.handle(req, res, nextHandler);
  }

  return undefined;
}

async function invokeErrorHandler(handler, err, req, res, nextHandler) {
  if (typeof handler === 'function' && handler.length === 4) {
    return handler(err, req, res, nextHandler);
  }
  return undefined;
}

export class Router {
  constructor() {
    this.stack = [];
  }

  use(pathOrHandler, ...handlers) {
    let path = '/';
    let resolvedHandlers = handlers;

    if (typeof pathOrHandler === 'string') {
      path = pathOrHandler;
    } else if (typeof pathOrHandler === 'function') {
      resolvedHandlers = [pathOrHandler, ...handlers];
    }

    this.stack.push({ type: 'use', path, handlers: resolvedHandlers });
    return this;
  }

  get(path, ...handlers) {
    this.stack.push({ type: 'route', method: 'GET', path, handlers });
    return this;
  }

  post(path, ...handlers) {
    this.stack.push({ type: 'route', method: 'POST', path, handlers });
    return this;
  }

  put(path, ...handlers) {
    this.stack.push({ type: 'route', method: 'PUT', path, handlers });
    return this;
  }

  delete(path, ...handlers) {
    this.stack.push({ type: 'route', method: 'DELETE', path, handlers });
    return this;
  }

  patch(path, ...handlers) {
    this.stack.push({ type: 'route', method: 'PATCH', path, handlers });
    return this;
  }

  /**
   * Dispatch principal — propaga errores a los error handlers (fn de 4 args).
   * Cuando next(err) se llama, saltea los handlers normales y busca el primer
   * error handler registrado.
   */
  async handle(req, res, next, initialError = undefined) {
    const dispatch = async (index = 0, currentError = undefined) => {
      if (index >= this.stack.length) {
        if (currentError) {
          // No hay más error handlers — propagar al next del padre
          if (typeof next === 'function') return next(currentError);
          console.error('Unhandled error:', currentError);
          res.status(500).json({ error: 'Error interno del servidor' });
          return;
        }
        if (typeof next === 'function') {
          return next();
        }
        return res.status(404).json({ error: 'No encontrado' });
      }

      const layer = this.stack[index];
      const method = (req.method || '').toUpperCase();

      // Si hay un error activo, solo interesamos en error handlers (4 args)
      if (currentError) {
        if (layer.type === 'use') {
          const hasErrorHandler = layer.handlers.some(isErrorHandler);
          if (!hasErrorHandler) return dispatch(index + 1, currentError);

          const match = matchMountPath(layer.path, req.path);
          if (!match) return dispatch(index + 1, currentError);

          const previousPath = req.path;
          req.path = match.remainingPath || req.path;

          const runErrorHandlers = async (handlerIndex = 0, err = currentError) => {
            if (handlerIndex >= layer.handlers.length) {
              req.path = previousPath;
              return dispatch(index + 1, err);
            }
            const handler = layer.handlers[handlerIndex];
            if (!isErrorHandler(handler)) {
              return runErrorHandlers(handlerIndex + 1, err);
            }
            if (res.finalized) return undefined;
            try {
              const nextErr = (nextError) => {
                if (nextError) return runErrorHandlers(handlerIndex + 1, nextError);
                req.path = previousPath;
                return dispatch(index + 1);
              };
              return await invokeErrorHandler(handler, err, req, res, nextErr);
            } catch (e) {
              return runErrorHandlers(handlerIndex + 1, e);
            }
          };
          return runErrorHandlers();
        }
        // route layers se saltean cuando hay error activo
        return dispatch(index + 1, currentError);
      }

      // Flujo normal (sin error)
      if (layer.type === 'use') {
        const match = matchMountPath(layer.path, req.path);
        if (!match) {
          return dispatch(index + 1);
        }

        const previousPath = req.path;
        req.path = match.remainingPath || req.path;

        const runHandlers = async (handlerIndex = 0) => {
          if (handlerIndex >= layer.handlers.length) {
            req.path = previousPath;
            return dispatch(index + 1);
          }

          const handler = layer.handlers[handlerIndex];
          // Error handlers se saltean en el flujo normal
          if (isErrorHandler(handler)) {
            return runHandlers(handlerIndex + 1);
          }

          const nextHandler = (err) => {
            if (err) {
              req.path = previousPath;
              return dispatch(index + 1, err);
            }
            return runHandlers(handlerIndex + 1);
          };

          if (res.finalized) return undefined;

          try {
            const result = await invokeHandler(handler, req, res, nextHandler);
            if (res.finalized) return result;
            if (result !== undefined) return result;
            return nextHandler();
          } catch (e) {
            return nextHandler(e);
          }
        };

        return runHandlers();
      }

      if (layer.method && layer.method !== method) {
        return dispatch(index + 1);
      }

      const match = matchRoutePath(layer.path, req.path);
      if (!match) {
        return dispatch(index + 1);
      }

      req.params = { ...(req.params || {}), ...(match.params || {}) };

      const runHandlers = async (handlerIndex = 0) => {
        if (handlerIndex >= layer.handlers.length) {
          return dispatch(index + 1);
        }

        const handler = layer.handlers[handlerIndex];
        if (isErrorHandler(handler)) {
          return runHandlers(handlerIndex + 1);
        }

        const nextHandler = (err) => {
          if (err) return dispatch(index + 1, err);
          return runHandlers(handlerIndex + 1);
        };

        if (res.finalized) return undefined;

        try {
          const result = await invokeHandler(handler, req, res, nextHandler);
          if (res.finalized) return result;
          if (result !== undefined) return result;
          return nextHandler();
        } catch (e) {
          return nextHandler(e);
        }
      };

      return runHandlers();
    };

    return dispatch(0, initialError);
  }
}

export class App extends Router {
  constructor() {
    super();
  }

  async handleRequest(request, env) {
    const url = new URL(request.url);
    const req = {
      method: request.method,
      path: url.pathname,
      originalPath: url.pathname,
      url,
      headers: Object.fromEntries(request.headers.entries()),
      query: Object.fromEntries(url.searchParams.entries()),
      body: {},
      params: {},
      cookies: {},
      env,
      request,
      secure: request.headers.get('x-forwarded-proto') === 'https' || url.protocol === 'https:',
      ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '0.0.0.0',
    };

    const cookieHeader = req.headers.cookie || '';
    req.cookies = Object.fromEntries(
      cookieHeader.split(';').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
        const separatorIndex = entry.indexOf('=');
        if (separatorIndex === -1) {
          return [entry, ''];
        }
        const key = entry.slice(0, separatorIndex).trim();
        const value = entry.slice(separatorIndex + 1).trim();
        return [key, decodeURIComponent(value)];
      })
    );

    const res = new ResponseAdapter();

    const topLevelErrorHandler = (err) => {
      if (!res.finalized) {
        console.error('Top-level unhandled error:', err);
        const status = err?.status || 500;
        const mensaje = status === 500 ? 'Error interno del servidor' : (err?.message || 'Error interno');
        res.status(status).json({ error: mensaje });
      }
    };

    await super.handle(req, res, () => {
      if (!res.finalized) res.status(404).json({ error: 'No encontrado' });
    }).catch(topLevelErrorHandler);

    return res.toResponse();
  }
}

class ResponseAdapter {
  constructor() {
    this.statusCode = 200;
    this.headers = new Headers();
    this.body = null;
    this.finalized = false;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(payload) {
    this.finalized = true;
    this.headers.set('content-type', 'application/json; charset=utf-8');
    this.body = JSON.stringify(payload);
    return this;
  }

  end(body = '') {
    this.finalized = true;
    this.body = body;
    return this;
  }

  cookie(name, value, options = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`];

    if (options.maxAge) {
      parts.push(`Max-Age=${options.maxAge}`);
    }
    if (options.httpOnly) {
      parts.push('HttpOnly');
    }
    if (options.secure) {
      parts.push('Secure');
    }
    if (options.sameSite) {
      parts.push(`SameSite=${options.sameSite}`);
    }
    if (options.domain) {
      parts.push(`Domain=${options.domain}`);
    }

    const existing = this.headers.get('set-cookie');
    const next = existing ? `${existing}, ${parts.join('; ')}` : parts.join('; ');
    this.headers.set('set-cookie', next);
    return this;
  }

  clearCookie(name, options = {}) {
    const parts = [`${name}=; Max-Age=0`];
    if (options.domain) {
      parts.push(`Domain=${options.domain}`);
    }
    const existing = this.headers.get('set-cookie');
    const next = existing ? `${existing}, ${parts.join('; ')}` : parts.join('; ');
    this.headers.set('set-cookie', next);
    return this;
  }

  toResponse() {
    if (!this.finalized && this.body === null) {
      return new Response('', { status: this.statusCode, headers: this.headers });
    }
    return new Response(this.body, { status: this.statusCode, headers: this.headers });
  }
}
