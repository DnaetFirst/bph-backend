import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src-node/services/authService.js';
import { authorize } from '../src-node/middlewares/authorize.js';

const config = { jwtSecret: 'clave-exclusiva-para-pruebas-locales', jwtExpirationSeconds: 3600 };
test('un enlace de recuperación no sirve para acceder a rutas de sesión', async () => {
  const service = new AuthService({ usuario: { findUnique: async () => { throw new Error('No debe consultar usuario'); } } }, config);
  const token = await service.crearTokenResetPin({ id: 1, nombre: 'Prueba', rol: 'administrador' });
  await assert.rejects(service.verificarSesion(token), { status: 401 });
  assert.equal((await service.verificarTokenResetPin(token)).id, 1);
});
test('desactivar una cuenta invalida el acceso aunque su token no haya expirado', async () => {
  const service = new AuthService({ usuario: { findUnique: async () => ({ id: 1, activo: false }) } }, config);
  const token = await service.crearToken({ id: 1, rol: 'administrador' });
  await assert.rejects(service.verificarSesion(token), { status: 401 });
});
test('permisos se obtienen del rol actual y no del rol antiguo en el token', async () => {
  const service = new AuthService({ usuario: { findUnique: async () => ({ id: 1, activo: true, nombre: 'Prueba', rol: 'evaluador' }) } }, config);
  const token = await service.crearToken({ id: 1, rol: 'administrador' });
  const usuario = await service.verificarSesion(token);
  assert.equal(usuario.rol, 'evaluador');
  let status;
  authorize('administrador', 'supervisor')({ usuario }, {
    status(code) { status = code; return this; }, json() {},
  }, () => assert.fail('El evaluador no debe poder modificar trabajadores'));
  assert.equal(status, 403);
});
