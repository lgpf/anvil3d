// Avaliador seguro de expressões numéricas para os campos: "45/2", "10+3,5", "(20-4)*2".
export function avaliar(texto) {
  const s = String(texto).replace(/,/g, '.').replace(/\s+/g, '');
  let i = 0;
  const num = () => {
    const m = /^\d*\.?\d+(e[-+]?\d+)?/i.exec(s.slice(i));
    if (!m) throw 0;
    i += m[0].length; return parseFloat(m[0]);
  };
  const fator = () => {
    if (s[i] === '-') { i++; return -fator(); }
    if (s[i] === '+') { i++; return fator(); }
    if (s[i] === '(') { i++; const v = soma(); if (s[i++] !== ')') throw 0; return v; }
    return num();
  };
  const termo = () => { let v = fator(); while (s[i] === '*' || s[i] === '/') v = s[i++] === '*' ? v * fator() : v / fator(); return v; };
  const soma = () => { let v = termo(); while (s[i] === '+' || s[i] === '-') v = s[i++] === '+' ? v + termo() : v - termo(); return v; };
  try { const v = soma(); return i === s.length && isFinite(v) ? v : NaN; } catch { return NaN; }
}
