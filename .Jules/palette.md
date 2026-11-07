# Palette's Journal - Atelier Beauty Studio

## 2026-11-06 - Modal Accessibility and Icon-Only Close Buttons
**Learning:** In the Atelier Beauty Studio dashboard, all modal dialogs rendered icon-only `<button className="icon-btn"><X size={18} /></button>` elements without `aria-label`, dialog roles, or accessible headers. For screen readers, these buttons were announced only as unlabelled buttons, and modals lacked `role="dialog"` and `aria-modal="true"`.
**Action:** When working on modal interfaces, always equip icon-only close buttons with localized `aria-label="Cerrar"` and associate the dialog container with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
