import { useNavigate } from "react-router-dom";
import { ClipboardList, Users, LayoutDashboard, History } from "lucide-react";
import { useAuthStore } from "../store/authStore";

const CardOpcion = ({ icon: Icon, titulo, subtitulo, onClick }) => (
  <div
    onClick={onClick}
    className="card-opcion"
    style={{
      background: "hsl(var(--color-surface))",
      border: "1px solid hsl(var(--color-table-border))",
      borderRadius: "var(--radius-lg)",
      cursor: "pointer",
      transition: "all 0.15s ease",
      boxShadow: "var(--shadow-sm)",
      textAlign: "left",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "0.75rem",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = "var(--shadow-md)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "var(--shadow-sm)";
    }}
  >
    <div style={{ width: 48, height: 48, borderRadius: 12, background: "hsla(var(--color-primary), 0.12)", display: "grid", placeItems: "center" }}>
      <Icon size={24} style={{ color: "hsl(var(--color-primary))" }} />
    </div>
    <h3 className="card-opcion-title">{titulo}</h3>
    <p className="card-opcion-subtitle" style={{ flex: 1 }}>{subtitulo}</p>
  </div>
);

export default function Inicio() {
  const { usuario } = useAuthStore();
  const navigate = useNavigate();

  const isAdmin = usuario?.rol === "administrador";
  const isSupervisor = usuario?.rol === "supervisor";
  const canManage = isAdmin || isSupervisor;

  return (
    <div className="animate-fade-in page-shell">
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 className="page-title">
          Bienvenido, {usuario?.nombre}
        </h1>
        <p className="page-subtitle">
          Selecciona una acción para comenzar. El acceso a cada sección depende de tu rol: <strong>{usuario?.rol}</strong>
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem", maxWidth: "960px", margin: "0 auto" }}>
        <CardOpcion
          icon={ClipboardList}
          titulo="Realizar Evaluación"
          subtitulo="Inicia una nueva evaluación BPH para un trabajador."
          onClick={() => navigate("/evaluar")}
        />

        {canManage && (
          <CardOpcion
            icon={Users}
            titulo="Trabajadores"
            subtitulo="Gestiona la lista de personal: altas, ediciones y estado."
            onClick={() => navigate("/trabajadores")}
          />
        )}

        <CardOpcion
          icon={LayoutDashboard}
          titulo="Dashboard Analítico"
          subtitulo="Visualiza indicadores, gráficas y el historial de evaluaciones."
          onClick={() => navigate("/dashboard")}
        />

        {canManage && (
          <CardOpcion
            icon={History}
            titulo="Bitácora"
            subtitulo="Revisa el registro de auditoría: quién hizo qué y cuándo."
            onClick={() => navigate("/bitacora")}
          />
        )}
      </div>
    </div>
  );
}
