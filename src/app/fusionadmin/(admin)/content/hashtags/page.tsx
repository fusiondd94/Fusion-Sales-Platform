import { addFusionHashtagsToPool } from "@/app/fusionadmin/actions";
import { getHashtagPool } from "@/lib/hashtags";
import { FusionField, FusionInput, FusionSubmitButton, PageHeader } from "../../crm-ui";
import "./hashtags-append.css";

export default async function HashtagPoolPage() {
  const pool = await getHashtagPool();
  const unusedCount = pool.filter((tag) => !tag.used).length;
  const usedCount = pool.length - unusedCount;

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Marketing"
        title="Hashtag pool"
        description="Every hashtag the randomizer can pull from. Green tags have already been used on a post - orange tags are fresh and get priority when a scheduled post is missing hashtags."
      />

      <article className="admin-panel">
        <div className="panel-heading">
          <h2>Add hashtags to the pool</h2>
        </div>
        <form action={addFusionHashtagsToPool} data-track-unsaved="true">
          <FusionField label="Hashtags">
            <FusionInput name="hashtags" placeholder="#WebDesign #SmallBusiness #Launch" required />
          </FusionField>
          <p className="muted" style={{ marginTop: -8, marginBottom: 12 }}>
            Separate with spaces, commas, or new lines. The &quot;#&quot; is optional - we&apos;ll add it.
          </p>
          <div className="fusion-form-actions fusion-form-actions--end">
            <FusionSubmitButton className="compact-button" pendingLabel="Adding...">
              Add to pool
            </FusionSubmitButton>
          </div>
        </form>
      </article>

      <article className="admin-panel">
        <div className="panel-heading">
          <h2>Pool ({pool.length})</h2>
          <span className="muted">
            {unusedCount} unused &middot; {usedCount} used
          </span>
        </div>
        {pool.length ? (
          <div className="hashtag-pool-grid">
            {pool.map((tag) => (
              <span
                className={tag.used ? "hashtag-chip hashtag-chip--used" : "hashtag-chip hashtag-chip--unused"}
                key={tag.id}
                title={tag.used ? `Used ${tag.useCount} time${tag.useCount === 1 ? "" : "s"}` : "Not used yet"}
              >
                {tag.tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="admin-empty">No hashtags in the pool yet. Add some above.</p>
        )}
      </article>
    </div>
  );
}
