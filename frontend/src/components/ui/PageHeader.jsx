export default function PageHeader({ titulo, subtitulo, acciones }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{titulo}</h1>
        {subtitulo && <p className="page-subtitle">{subtitulo}</p>}
      </div>
      {acciones && <div className="action-group">{acciones}</div>}
    </div>
  );
}
