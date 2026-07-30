import Link from "next/link";
import { Facebook, Instagram, MessageCircle, Palette, Settings, Tags, Trash2, UsersRound } from "lucide-react";
import {
  inviteFusionTeamMember,
  updateFusionBrandSettings,
  updateFusionServicePackage,
  deleteFusionServicePackage
} from "@/app/fusionadmin/actions";
import { getFusionAdminSettings } from "@/lib/crm";
import { getMessagingWorkspace } from "@/lib/messages";
import { EmptyState, formatCurrency, FusionSubmitButton, PageHeader } from "../crm-ui";

export default async function FusionSettingsPage() {
  const admin = await getFusionAdminSettings();
  const { channels } = await getMessagingWorkspace();

  const connectedByType: Record<string, boolean> = {};
  for (const channel of channels) {
    connectedByType[channel.channel_type] = channel.status === "connected";
  }

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Settings"
        title="Configure services, brand, team, and roles"
        description="Control the platform settings that shape pricing, admin identity, and backend access."
      />

      <section className="admin-two-column">
        <article className="admin-panel">
          <div className="panel-heading">
            <h2><MessageCircle size={20} /> Connections</h2>
            <Link className="secondary-button compact-button" href="/fusionadmin/settings/connections">Manage</Link>
          </div>
          <p className="muted">Connect Facebook, Instagram, and WhatsApp so you can message customers and auto-publish content.</p>
          <div className="content-channel-strip">
            <span className={connectedByType.messenger ? "platform-chip platform-chip--connected" : "platform-chip platform-chip--disconnected"}>
              <Facebook size={14} /> Facebook · {connectedByType.messenger ? "Connected" : "Not connected"}
            </span>
            <span className={connectedByType.instagram ? "platform-chip platform-chip--connected" : "platform-chip platform-chip--disconnected"}>
              <Instagram size={14} /> Instagram · {connectedByType.instagram ? "Connected" : "Not connected"}
            </span>
            <span className={connectedByType.whatsapp ? "platform-chip platform-chip--connected" : "platform-chip platform-chip--disconnected"}>
              <MessageCircle size={14} /> WhatsApp · {connectedByType.whatsapp ? "Connected" : "Not connected"}
            </span>
          </div>
        </article>

        <article className="admin-panel">
          <h2><Palette size={20} /> Brand settings</h2>
          <form className="quick-form" action={updateFusionBrandSettings} data-track-unsaved="true">
            <label>
              <span>Logo</span>
              <div className="brand-logo-row">
                {admin.settings?.logo_url ? <img alt="Current logo" className="brand-logo-preview" src={admin.settings.logo_url} /> : null}
                <input accept="image/*" name="logoFile" type="file" />
              </div>
            </label>
            <label>
              <span>Or paste a logo URL</span>
              <input defaultValue={admin.settings?.logo_url || ""} name="logoUrl" placeholder="https://..." type="url" />
            </label>
            <label>
              <span>Primary color</span>
              <div className="color-input-pair">
                <input defaultValue={admin.settings?.primary_color || "#31d7ff"} name="primaryColor" type="color" />
                <input defaultValue={admin.settings?.primary_color || ""} maxLength={7} name="primaryColorHex" placeholder="#31d7ff" />
              </div>
            </label>
            <label>
              <span>Accent color</span>
              <div className="color-input-pair">
                <input defaultValue={admin.settings?.accent_color || "#f5b84b"} name="accentColor" type="color" />
                <input defaultValue={admin.settings?.accent_color || ""} maxLength={7} name="accentColorHex" placeholder="#f5b84b" />
              </div>
            </label>
            <FusionSubmitButton pendingLabel="Saving...">Save brand</FusionSubmitButton>
          </form>
        </article>

        <article className="admin-panel">
          <div className="panel-heading">
            <h2><Settings size={20} /> Organization</h2>
            <span className="status-pill">{admin.organization?.default_currency || "USD"}</span>
          </div>
          <div className="settings-list">
            <p><strong>Name</strong><span>{admin.organization?.name || "Fusion Digital Dynamics LLC"}</span></p>
            <p><strong>Website</strong><span>{admin.organization?.website || "https://fddynamics.com"}</span></p>
            <p><strong>Time zone</strong><span>{admin.organization?.default_time_zone || "America/New_York"}</span></p>
            <p><strong>Lead statuses</strong><span>{admin.settings?.lead_statuses.join(", ") || "Seed after migration"}</span></p>
          </div>
        </article>

        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><Tags size={20} /> Service pricing</h2>
            <span className="status-pill">{admin.packages.length} packages</span>
          </div>
          <div className="pricing-admin-grid">
            {admin.packages.map((item) => (
              <div className="price-editor-wrap" key={item.id}>
                <form className="price-editor" action={updateFusionServicePackage} data-track-unsaved="true">
                  <input name="packageId" type="hidden" value={item.id} />
                  <div className="price-editor-heading">
                    <strong>{item.package_key}</strong>
                    <label className="toggle-row">
                      <input defaultChecked={item.is_active} name="isActive" type="checkbox" />
                      <span>Active</span>
                    </label>
                  </div>
                  <label>
                    <span>Package name</span>
                    <input defaultValue={item.package_name} name="packageName" required />
                  </label>
                  <label>
                    <span>Description</span>
                    <textarea defaultValue={item.description || ""} name="description" />
                  </label>
                  <div className="form-grid two">
                    <label>
                      <span>Setup price</span>
                      <input defaultValue={item.setup_price} min="0" name="setupPrice" type="number" />
                    </label>
                    <label>
                      <span>Monthly price</span>
                      <input defaultValue={item.monthly_price} min="0" name="monthlyPrice" type="number" />
                    </label>
                  </div>
                  <p className="muted">{formatCurrency(item.setup_price)} setup · {formatCurrency(item.monthly_price)}/mo</p>
                  <FusionSubmitButton pendingLabel="Saving...">Save pricing</FusionSubmitButton>
                </form>
                <form action={deleteFusionServicePackage}>
                  <input name="packageId" type="hidden" value={item.id} />
                  <button className="ghost-button compact-button content-delete-button" type="submit">
                    <Trash2 size={14} /> Delete package
                  </button>
                </form>
              </div>
            ))}
            {!admin.packages.length ? <EmptyState>Service packages will appear after the settings migration runs.</EmptyState> : null}
          </div>
        </article>

        <article className="admin-panel">
          <h2><UsersRound size={20} /> Add user</h2>
          <form className="quick-form" action={inviteFusionTeamMember} data-track-unsaved="true">
            <input name="displayName" placeholder="Full name" />
            <input name="email" placeholder="Email address" type="email" required />
            <input name="title" placeholder="Title or responsibility" />
            <select name="roleId" defaultValue="">
              <option value="">Select role</option>
              {admin.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            <FusionSubmitButton pendingLabel="Inviting...">Invite user</FusionSubmitButton>
          </form>
        </article>

        <article className="admin-panel">
          <div className="panel-heading">
            <h2><UsersRound size={20} /> Access snapshot</h2>
            <span className="status-pill">{admin.members.length} users</span>
          </div>
          <div className="stack-list">
            {admin.members.slice(0, 6).map((member) => (
              <p key={member.id}>
                <a className="fusion-record-link" href={`/fusionadmin/team?memberId=${member.id}#member-editor`}>{member.crm_profiles?.display_name || "Team member"}</a>
                <br /><span className="muted">{member.crm_profiles?.email || member.user_id} · {member.status}</span>
              </p>
            ))}
            {!admin.members.length ? <EmptyState>No teammates have been added yet.</EmptyState> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
