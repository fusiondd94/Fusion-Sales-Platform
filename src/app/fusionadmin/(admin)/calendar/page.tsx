import { CalendarDays, PlusCircle } from "lucide-react";
import { createFusionAppointment } from "@/app/fusionadmin/actions";
import { getSalesOpsWorkspace } from "@/lib/sales-ops";
import { EmptyState, formatDate, PageHeader } from "../crm-ui";

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default async function FusionCalendarPage() {
  const salesOps = await getSalesOpsWorkspace();

  return (
    <div className="admin-content">
      <PageHeader
        eyebrow="Calendar"
        title="Internal sales calendar"
        description="Schedule discovery calls, proposal reviews, follow-ups, and kickoff meetings tied to CRM work."
      />

      <section className="admin-two-column">
        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><CalendarDays size={20} /> Agenda</h2>
            <span className="status-pill">{salesOps.appointments.length} appointments</span>
          </div>
          <div className="stack-list">
            {salesOps.appointments.map((appointment) => (
              <p key={appointment.id}>
                <strong>{appointment.title}</strong><br />
                <span className="muted">
                  {formatDate(appointment.starts_at)} · {formatTime(appointment.starts_at)}-{formatTime(appointment.ends_at)} · {appointment.status}
                </span>
              </p>
            ))}
            {!salesOps.appointments.length ? <EmptyState>No appointments scheduled.</EmptyState> : null}
          </div>
        </article>

        <article className="admin-panel">
          <h2><PlusCircle size={20} /> Schedule appointment</h2>
          <form className="quick-form" action={createFusionAppointment}>
            <input name="title" placeholder="Appointment title" required />
            <select name="appointmentTypeId" defaultValue="">
              <option value="">Appointment type</option>
              {salesOps.appointmentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
            <label>
              <span>Starts</span>
              <input name="startsAt" type="datetime-local" required />
            </label>
            <label>
              <span>Ends</span>
              <input name="endsAt" type="datetime-local" required />
            </label>
            <input name="location" placeholder="Location" />
            <input name="meetingUrl" placeholder="Meeting URL" type="url" />
            <button className="primary-button" type="submit">Schedule</button>
          </form>
        </article>
      </section>
    </div>
  );
}
