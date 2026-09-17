import { SimMath } from "@/components/simulations/SimMath";

const EQUATIONS = [
  "\\Phi = \\oint \\vec{E} \\cdot d\\vec{A} = \\frac{Q_{enc}}{\\varepsilon_0}",
  "\\varepsilon_0 = 8.85 \\times 10^{-12} \\text{ C}^2/(\\text{N}\\cdot\\text{m}^2)",
  "E_{\\text{point}} = \\frac{1}{4\\pi\\varepsilon_0}\\frac{Q}{r^2}",
  "E_{\\text{line}} = \\frac{\\lambda}{2\\pi\\varepsilon_0 r}",
  "E_{\\text{plane}} = \\frac{\\sigma}{2\\varepsilon_0}",
  "E_{\\text{inside ball}} = \\frac{1}{4\\pi\\varepsilon_0}\\frac{Q\\,r}{R^3}",
];

export function GaussLawNotes() {
  return (
    <>
      <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
        <h3 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-1">Key Insight</h3>
        <p className="text-xs text-green-700 dark:text-green-400">
          The electric flux through a closed Gaussian surface depends <strong>only on the enclosed charge</strong>, not
          on the shape or size of the surface. Move the surface and change its radius: as long as the same charge is
          enclosed, the net flux stays the same. The number of field arrows grows with the charge, like field lines in
          a textbook, and their length follows the field strength.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Key Equations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-400 font-mono">
          {EQUATIONS.map((eq) => (
            <div key={eq} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
              <SimMath math={eq} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
