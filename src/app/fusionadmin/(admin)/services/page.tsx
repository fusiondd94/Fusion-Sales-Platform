import { Library, PlusCircle } from "lucide-react";
import { createFusionService } from "@/app/fusionadmin/actions";
import { getSalesOpsWorkspace } from "@/lib/sales-ops";
import { EmptyState, formatCurrency, FusionDataTable, PageHeader } from "../crm-ui";

export default async function FusionServicesPage() {
  const salesOps = await getSalesOpsWorkspace();

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Service catalog"
        title="Manage sellable Fusion services"
        description="Keep pricing, recurring services, internal costs, and proposal-ready catalog items in one place."
      />

      <section className="admin-two-column">
        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><Library size={20} /> Catalog</h2>
            <span className="status-pill">{salesOps.services.length} services</span>
          </div>
          <FusionDataTable
            aria-label="Service catalog"
            columns={[
              { header: "Service", priority: "primary" },
              { header: "Billing" },
              { header: "Price" },
              { header: "Cost" },
              { header: "Status" }
            ]}
            empty={!salesOps.services.length ? <EmptyState>No services yet.</EmptyState> : null}
          >
            {salesOps.services.map((service) => (
              <tr key={service.id}>
                <td data-label="Service">{service.service_name}<br /><span className="muted">{service.sku} · {service.short_description || "No description"}</span></td>
                <td data-label="Billing">{service.billing_type}<br /><span className="muted">{service.recurring_interval || service.pricing_model}</span></td>
                <td data-label="Price">{formatCurrency(service.base_price)}</td>
                <td data-label="Cost">{formatCurrency(service.internal_estimated_cost)}</td>
                <td data-label="Status"><span className="status-pill">{service.is_active ? "active" : "inactive"}</span></td>
              </tr>
            ))}
          </FusionDataTable>
        </article>

        <article className="admin-panel">
          <h2><PlusCircle size={20} /> Add service</h2>
          <form className="quick-form" action={createFusionService}>
            <input name="serviceName" placeholder="Service name" required />
            <input name="sku" placeholder="SKU" required />
            <select name="categoryId" defaultValue="">
              <option value="">Category</option>
              {salesOps.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <textarea name="shortDescription" placeholder="Short description" />
            <select name="billingType" defaultValue="one_time">
              <option value="one_time">One-time</option>
              <option value="recurring">Recurring</option>
              <option value="usage_based">Usage-based</option>
              <option value="custom_quote">Custom quote</option>
            </select>
            <select name="pricingModel" defaultValue="fixed_price">
              <option value="fixed_price">Fixed price</option>
              <option value="starting_at">Starting at</option>
              <option value="price_range">Price range</option>
              <option value="per_unit">Per unit</option>
              <option value="hourly">Hourly</option>
              <option value="custom_quote">Custom quote</option>
            </select>
            <input min="0" name="basePrice" placeholder="Base price" type="number" />
            <input min="0" name="internalEstimatedCost" placeholder="Internal estimated cost" type="number" />
            <select name="recurringInterval" defaultValue="">
              <option value="">No interval</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="semiannual">Semiannual</option>
              <option value="annual">Annual</option>
              <option value="custom">Custom</option>
            </select>
            <label className="toggle-row"><input defaultChecked name="publicVisibility" type="checkbox" /> <span>Publicly visible</span></label>
            <label className="toggle-row"><input name="isFeatured" type="checkbox" /> <span>Featured</span></label>
            <button className="primary-button" type="submit">Create service</button>
          </form>
        </article>
      </section>
    </div>
  );
}
