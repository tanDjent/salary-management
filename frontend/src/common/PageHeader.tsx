type PageHeaderProps = {
  title: string;
  /** Short context under the title, e.g. how many records are showing. */
  subtitle?: string;
  /** Page-level actions, right-aligned on the title row. */
  actions?: React.ReactNode;
};

/** Owned by the page rather than the layout, so a page can put its primary
 *  action on the title row instead of inventing a second heading below it. */
export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-medium">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>

      {actions}
    </div>
  );
}
