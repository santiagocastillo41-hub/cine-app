const TYPE_SCALE = [
  { cls: "type-display-xl", label: "Display", spec: "display/xl · 32/38", sample: "Guardá una película" },
  { cls: "type-display-lg", label: "Título 1", spec: "display/lg · 26/31", sample: "Cine de autor" },
  { cls: "type-display-md", label: "Título 2", spec: "display/md · 20/26", sample: "Películas donde no pasa nada" },
  { cls: "type-display-sm", label: "Título 3", spec: "display/sm · 16/21", sample: "Perfect Days" },
  { cls: "type-display-xs", label: "Título 4", spec: "display/xs · 15.5/19", sample: "Fila de watchlist y foro" },
  { cls: "type-body-lg", label: "Cuerpo L", spec: "body/lg · 15/24", sample: "Nico tenía razón pero no como yo pensaba." },
  { cls: "type-body-md", label: "Cuerpo", spec: "body/md · 14/22.6", sample: "Mensajes, notas y respuestas. El tamaño más usado de la app." },
  { cls: "type-body-sm", label: "Cuerpo S", spec: "body/sm · 13/20", sample: "Preview de hilo, descripciones secundarias." },
  { cls: "type-label", label: "Label", spec: "label · 12.5/17", sample: "Nombre de usuario, botón chico" },
  { cls: "type-caption", label: "Caption", spec: "caption · 11.5/16", sample: "2023 · Wim Wenders · 124′ · Japón" },
  { cls: "type-section", label: "Sección", spec: "section · 12.5/17", sample: "Seguís 3 foros" },
];

const SURFACES = [
  { name: "bg/base", cls: "bg-bg", hex: "#08090B" },
  { name: "surface/low", cls: "bg-surface-low", hex: "#101214" },
  { name: "surface/med", cls: "bg-surface-med", hex: "#17191D" },
  { name: "surface/high", cls: "bg-surface-high", hex: "#1E2126" },
];

const BORDERS = [
  { name: "border/subtle", cls: "bg-border-subtle", hex: "#191C20" },
  { name: "border/default", cls: "bg-border", hex: "#24272C" },
  { name: "border/strong", cls: "bg-border-strong", hex: "#33373D" },
];

const TEXT = [
  { name: "text/primary", cls: "bg-text-primary", hex: "#EDEFF2" },
  { name: "text/secondary", cls: "bg-text-secondary", hex: "#8E959D" },
  { name: "text/tertiary", cls: "bg-text-tertiary", hex: "#5C636B" },
  { name: "text/disabled", cls: "bg-text-disabled", hex: "#3C424A" },
];

const ACCENT = [
  { name: "accent", cls: "bg-accent", hex: "#0088FF" },
  { name: "accent/pressed", cls: "bg-accent-pressed", hex: "#0070D6" },
  { name: "accent/text", cls: "bg-accent-text", hex: "#4DA9FF" },
  { name: "accent/bg", cls: "bg-accent-bg", hex: "13% opacidad" },
];

const SEMANTIC = [
  { name: "warning", cls: "bg-warning", hex: "#E0A83C" },
  { name: "danger", cls: "bg-danger", hex: "#E5484D" },
];

const RADII = [
  { name: "radius/xs · 3", cls: "rounded-xs" },
  { name: "radius/sm · 8", cls: "rounded-sm" },
  { name: "radius/md · 10", cls: "rounded-md" },
  { name: "radius/lg · 12", cls: "rounded-lg" },
  { name: "radius/xl · 22", cls: "rounded-xl" },
  { name: "radius/full", cls: "rounded-full" },
];

function Swatch({ name, cls, hex }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg p-3.5">
      <div className={`mb-3 h-[46px] rounded-[7px] border border-white/5 ${cls}`} />
      <div className="type-label text-text-primary">{name}</div>
      <div className="type-caption mt-0.5 text-text-tertiary tabular-nums">{hex}</div>
    </div>
  );
}

function SwatchGrid({ title, swatches }) {
  return (
    <div className="mb-8">
      <div className="type-section mb-3 border-b border-border-subtle pb-2 text-text-tertiary">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {swatches.map((s) => (
          <Swatch key={s.name} {...s} />
        ))}
      </div>
    </div>
  );
}

export default function TokenPreview() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <header className="mb-14 border-b border-border pb-8">
        <div className="type-section mb-3 text-accent-text">tokens · verificación</div>
        <h1 className="type-display-xl">Sistema de diseño</h1>
        <p className="type-body-md mt-3 max-w-md text-text-secondary">
          Escala tipográfica y paleta cargadas desde <code className="type-caption rounded-xs border border-accent-bd bg-accent-bg px-1.5 py-0.5 text-accent-text">src/index.css</code>{" "}
          como tokens de Tailwind. Dark-first, sin modo alternativo.
        </p>
      </header>

      <section className="mb-14">
        <div className="type-section mb-4 border-b border-border-subtle pb-2 text-text-tertiary">
          Escala tipográfica
        </div>
        <div>
          {TYPE_SCALE.map((row) => (
            <div
              key={row.cls}
              className="flex items-baseline gap-6 border-b border-border-subtle py-4 last:border-0"
            >
              <div className="w-28 shrink-0">
                <div className="type-label text-text-primary">{row.label}</div>
                <div className="type-caption mt-0.5 text-text-tertiary tabular-nums">{row.spec}</div>
              </div>
              <div className={`${row.cls} min-w-0 flex-1 truncate text-text-primary`}>{row.sample}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="type-section mb-4 border-b border-border-subtle pb-2 text-text-tertiary">
          Paleta
        </div>
        <SwatchGrid title="Superficies" swatches={SURFACES} />
        <SwatchGrid title="Bordes" swatches={BORDERS} />
        <SwatchGrid title="Texto" swatches={TEXT} />
        <SwatchGrid title="Acento" swatches={ACCENT} />
        <SwatchGrid title="Semántico" swatches={SEMANTIC} />

        <div className="mb-8">
          <div className="type-section mb-3 border-b border-border-subtle pb-2 text-text-tertiary">
            Radios
          </div>
          <div className="flex flex-wrap items-end gap-4">
            {RADII.map((r) => (
              <div key={r.name} className="text-center">
                <div className={`mb-2 h-14 w-14 border border-accent-bd bg-accent-bg ${r.cls}`} />
                <div className="type-caption text-text-tertiary">{r.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
