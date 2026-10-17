// Comparaison de versions « 0.1.43 » en nombres, partagée par publier.cjs et publier-play.cjs.
const nombres = (v) => v.split(".").map((n) => parseInt(n, 10) || 0);
const plusRecente = (a, b) => {
  const [x, y] = [nombres(a), nombres(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};
module.exports = { nombres, plusRecente };
