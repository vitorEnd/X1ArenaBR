const items = [
  "Eventos semanais",
  "Todos os X1 acontecem no Park",
  "Ranking contínuo",
  "Três categorias",
  "Desafios e revanches",
  "Cinturões em disputa",
  "Entre para a Arena",
];

export function Ticker() {
  const repeated = [...items, ...items];
  return (
    <div className="ticker" aria-label="Destaques da Arena">
      <div className="ticker__track">
        {repeated.map((item, index) => (
          <span key={`${item}-${index}`} aria-hidden={index >= items.length}>
            {item} <b>◆</b>
          </span>
        ))}
      </div>
    </div>
  );
}
