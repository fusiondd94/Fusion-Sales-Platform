import { CalendarDays, PlusCircle } from "lucide-react";
import { createFusionAppointment, updateFusionAppointment } from "@/app/fusionadmin/actions";
import { getSalesOpsWorkspace, type SalesOpsAppointment } from "@/lib/sales-ops";
import { EmptyState, PageHeader } from "../crm-ui";

const appointmentStatuses = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function toDateTimeLocal(value: string) {
  return new Date(value).toISOString().slice(0, 16);
}

function monthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function buildCalendarDays(referenceDate: Date) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date,
      key: monthKey(date),
      isCurrentMonth: date.getMonth() === month,
      dayNumber: date.getDate()
    };
  });
}

export default async function FusionCalendarPage() {
  const salesOps = await getSalesOpsWorkspace();
  const referenceDate = new Date();
  const monthDays = buildCalendarDays(referenceDate);
  const monthTitle = referenceDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const appointmentsByDate = new Map<string, SalesOpsAppointment[]>();

  for (const appointment of salesOps.appointments) {
    const key = monthKey(new Date(appointment.starts_at));
    const dayAppointments = appointmentsByDate.get(key) || [];
    dayAppointments.push(appointment);
    appointmentsByDate.set(key, dayAppointments);
  }

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
            <h2><CalendarDays size={20} /> {monthTitle}</h2>
            <span className="status-pill">{salesOps.appointments.length} appointments</span>
          </div>
          <div className="calendar-board" aria-label={`${monthTitle} sales calendar`}>
            <div className="calendar-weekdays">
              {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
            </div>
            <div className="calendar-grid">
              {monthDays.map((day) => (
                <div className={day.isCurrentMonth ? "calendar-day" : "calendar-day outside-month"} key={day.key}>
                  <span className="calendar-day-number">{day.dayNumber}</span>
                  {(appointmentsByDate.get(day.key) || []).map((appointment) => (
                    <a className="calendar-event" href={`#appointment-${appointment.id}`} key={appointment.id}>
                      <strong>{formatTime(appointment.starts_at)}</strong>
                      <span>{appointment.title}</span>
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {!salesOps.appointments.length ? <p className="admin-empty calendar-empty-note">No appointments scheduled yet. The calendar stays visible so you can see the month at a glance.</p> : null}
        </article>

        <article className="admin-panel panel-span-2">
          <div className="panel-heading">
            <h2><CalendarDays size={20} /> Appointment editor</h2>
            <span className="status-pill">{salesOps.appointments.length}</span>
          </div>
          <div className="appointment-edit-grid">
            {salesOps.appointments.map((appointment) => (
              <form className="record-edit-card" action={updateFusionAppointment} id={`appointment-${appointment.id}`} key={appointment.id}>
                <input name="appointmentId" type="hidden" value={appointment.id} />
                <div className="record-edit-heading">
                  <strong>{appointment.title}</strong>
                  <span className="status-pill">{appointment.status.replace("_", " ")}</span>
                </div>
                <div className="record-edit-grid">
                  <label>
                    Title
                    <input name="title" defaultValue={appointment.title} required />
                  </label>
                  <label>
                    Type
                    <select name="appointmentTypeId" defaultValue={appointment.appointment_type_id || ""}>
                      <option value="">General appointment</option>
                      {salesOps.appointmentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Status
                    <select name="status" defaultValue={appointment.status}>
                      {appointmentStatuses.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
                    </select>
                  </label>
                  <label>
                    Starts
                    <input name="startsAt" type="datetime-local" defaultValue={toDateTimeLocal(appointment.starts_at)} required />
                  </label>
                  <label>
                    Ends
                    <input name="endsAt" type="datetime-local" defaultValue={toDateTimeLocal(appointment.ends_at)} required />
                  </label>
                  <label>
                    Location
                    <input name="location" defaultValue={appointment.location || ""} />
                  </label>
                  <label className="full-field">
                    Meeting URL
                    <input name="meetingUrl" defaultValue={appointment.meeting_url || ""} type="url" />
                  </label>
                </div>
                <button className="secondary-button compact-button" type="submit">Save appointment</button>
              </form>
            ))}
            {!salesOps.appointments.length ? <EmptyState>No appointments to edit yet. Schedule one from the form.</EmptyState> : null}
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
