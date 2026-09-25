interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

// A labelled form control with an optional helper line under it
const Field: React.FC<FieldProps> = ({ label, hint, children }) => (
  <div>
    <label className="label whitespace-nowrap">{label}</label>
    {children}
    {hint && <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{hint}</p>}
  </div>
);

export default Field;
