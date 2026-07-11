import { FusionLoadingState, FusionSkeleton } from "./crm-ui";

export default function FusionAdminLoading() {
  return (
    <div className="admin-content">
      <FusionLoadingState
        title="Loading admin workspace"
        description="Fetching the latest CRM records and sales operations data."
      />
      <section className="admin-loading-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <article className="admin-panel admin-loading-panel" key={index}>
            <FusionSkeleton className="admin-loading-title" />
            <FusionSkeleton />
            <FusionSkeleton />
            <FusionSkeleton className="admin-loading-row" />
          </article>
        ))}
      </section>
    </div>
  );
}
