import { Library, PlusCircle } from "lucide-react";
import { createFusionService, updateFusionService } from "@/app/fusionadmin/actions";
import { getSalesOpsWorkspace } from "@/lib/sales-ops";
import {
  EmptyState,
  formatCurrency,
  FusionDataTable,
  FusionField,
  FusionInput,
  FusionSelect,
  FusionSubmitButton,
  FusionSwitch,
  FusionTextarea,
  PageHeader
} from "../crm-ui";

type PageProps = {
  searchParams?: Promise<{ serviceId?: string }>;
};

export default async function FusionServicesPage({ searchParams }: PageProps) {
  const filters = (await searchParams) || {};
  const salesOps = await getSalesOpsWorkspace();
  const selectedService = salesOps.services.find((service) => service.id === filters.serviceId);

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Service catalog"
        title="Manage sellable Fusion services"
        description="Keep pricing, recurring services, internal costs, and proposal-ready catalog items in one place."
      />

      <section className="admin-two-column">
        <article className="admin-panel panel-span-2" id="service-editor">
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
              { header: "Status" },
              { header: "Action", className: "table-action-column" }
            ]}
            empty={!salesOps.services.length ? <EmptyState>No services yet.</EmptyState> : null}
          >
            {salesOps.services.map((service) => (
              <tr key={service.id}>
                <td data-label="Service">
                  <a className="fusion-record-link" href={`/fusionadmin/services?serviceId=${service.id}#service-editor`}>{service.service_name}</a>
                  <br /><span className="muted">{service.sku} · {service.short_description || "No description"}</span>
                </td>
                <td data-label="Billing">{service.billing_type}<br /><span className="muted">{service.recurring_interval || service.pricing_model}</span></td>
                <td data-label="Price">{formatCurrency(service.base_price)}</td>
                <td data-label="Cost">{formatCurrency(service.internal_estimated_cost)}</td>
                <td data-label="Status"><span className="status-pill">{service.is_active ? "active" : "inactive"}</span></td>
                <td data-label="Action"><a className="secondary-button compact-button table-action-button" href={`/fusionadmin/services?serviceId=${service.id}#service-editor`}>Edit</a></td>
              </tr>
            ))}
          </FusionDataTable>

          {selectedService ? (
            <form action={updateFusionService} data-track-unsaved="true" style={{ marginTop: "1rem" }}>
              <input name="serviceId" type="hidden" value={selectedService.id} />
              <div className="fusion-form-section__grid">
                <FusionField label="Service name" required>
                  <FusionInput defaultValue={selectedService.service_name} name="serviceName" required />
                </FusionField>
                <FusionField label="SKU" required>
                  <FusionInput defaultValue={selectedService.sku} name="sku" required />
                </FusionField>
                <FusionField label="Category">
                  <FusionSelect defaultValue={selectedService.category_id || ""} name="categoryId">
                    <option value="">Category</option>
                    {salesOps.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </FusionSelect>
                </FusionField>
                <FusionField className="fusion-field--full" label="Short description">
                  <FusionTextarea defaultValue={selectedService.short_description || ""} name="shortDescription" />
                </FusionField>
                <FusionField label="Billing type">
                  <FusionSelect defaultValue={selectedService.billing_type} name="billingType">
                    <option value="one_time">One-time</option>
                    <option value="recurring">Recurring</option>
                    <option value="usage_based">Usage-based</option>
                    <option value="custom_quote">Custom quote</option>
                  </FusionSelect>
                </FusionField>
                <FusionField label="Pricing model">
                  <FusionSelect defaultValue={selectedService.pricing_model} name="pricingModel">
                    <option value="fixed_price">Fixed price</option>
                    <option value="starting_at">Starting at</option>
                    <option value="price_range">Price range</option>
                    <option value="per_unit">Per unit</option>
                    <option value="hourly">Hourly</option>
                    <option value="custom_quote">Custom quote</option>
                  </FusionSelect>
                </FusionField>
                <FusionField label="Base price">
                  <FusionInput defaultValue={selectedService.base_price} min="0" name="basePrice" type="number" />
                </FusionField>
                <FusionField label="Internal estimated cost">
                  <FusionInput defaultValue={selectedService.internal_estimated_cost} min="0" name="internalEstimatedCost" type="number" />
                </FusionField>
                <FusionField label="Recurring interval">
                  <FusionSelect defaultValue={selectedService.recurring_interval || ""} name="recurringInterval">
                    <option value="">No interval</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="semiannual">Semiannual</option>
                    <option value="annual">Annual</option>
                    <option value="custom">Custom</option>
                  </FusionSelect>
                </FusionField>
              </div>
              <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", margin: "0.5rem 0 1rem" }}>
                <FusionSwitch defaultChecked={selectedService.public_visibility} label="Publicly visible" name="publicVisibility" />
                <FusionSwitch defaultChecked={selectedService.is_featured} label="Featured" name="isFeatured" />
                <FusionSwitch defaultChecked={selectedService.is_active} label="Active" name="isActive" />
              </div>
              <div className="fusion-form-actions fusion-form-actions--end">
                <a className="ghost-button compact-button" href="/fusionadmin/services">Close</a>
                <FusionSubmitButton className="compact-button" pendingLabel="Saving service...">Save service</FusionSubmitButton>
              </div>
            </form>
          ) : null}
        </article>

        <article className="admin-panel">
          <h2><PlusCircle size={20} /> Add service</h2>
          <form className="quick-form" action={createFusionService} data-track-unsaved="true">
            <input aria-label="Service name" name="serviceName" placeholder="Service name" required />
            <input aria-label="SKU" name="sku" placeholder="SKU" required />
            <select aria-label="Service category" name="categoryId" defaultValue="">
              <option value="">Category</option>
              {salesOps.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <textarea aria-label="Short description" name="shortDescription" placeholder="Short description" />
            <select aria-label="Billing type" name="billingType" defaultValue="one_time">
              <option value="one_time">One-time</option>
              <option value="recurring">Recurring</option>
              <option value="usage_based">Usage-based</option>
              <option value="custom_quote">Custom quote</option>
            </select>
            <select aria-label="Pricing model" name="pricingModel" defaultValue="fixed_price">
              <option value="fixed_price">Fixed price</option>
              <option value="starting_at">Starting at</option>
              <option value="price_range">Price range</option>
              <option value="per_unit">Per unit</option>
              <option value="hourly">Hourly</option>
              <option value="custom_quote">Custom quote</option>
            </select>
            <input aria-label="Base price" min="0" name="basePrice" placeholder="Base price" type="number" />
            <input aria-label="Internal estimated cost" min="0" name="internalEstimatedCost" placeholder="Internal estimated cost" type="number" />
            <select aria-label="Recurring interval" name="recurringInterval" defaultValue="">
              <option value="">No interval</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="semiannual">Semiannual</option>
              <option value="annual">Annual</option>
              <option value="custom">Custom</option>
            </select>
            <label className="toggle-row"><input defaultChecked name="publicVisibility" type="checkbox" /> <span>Publicly visible</span></label>
            <label className="toggle-row"><input name="isFeatured" type="checkbox" /> <span>Featured</span></label>
            <FusionSubmitButton pendingLabel="Creating...">Create service</FusionSubmitButton>
          </form>
        </article>
      </section>
    </div>
  );
}
