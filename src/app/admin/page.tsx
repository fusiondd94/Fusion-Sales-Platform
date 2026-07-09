import { ClipboardList, UsersRound } from "lucide-react";
import { demoClients, demoTasks } from "@/lib/records";

export default function AdminPage() {
  return (
    <main className="shell">
      <div className="admin-shell">
        <nav className="nav" style={{ paddingInline: 0 }}>
          <a className="brand" href="/">
            <span className="brand-mark">FDD</span>
            <span>Fusion CRM</span>
          </a>
          <a className="nav-cta" href="/">Sales page</a>
        </nav>

        <section className="section" style={{ paddingInline: 0, paddingTop: "2rem" }}>
          <p className="eyebrow">Backend command center</p>
          <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 4.8rem)" }}>Clients, deals, and production tasks.</h1>
          <div className="sales-grid">
            <article className="admin-panel">
              <h2><UsersRound size={22} /> CRM Pipeline</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Package</th>
                    <th>Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {demoClients.map((client) => (
                    <tr key={client.id}>
                      <td>{client.company}<br /><span className="muted">{client.email}</span></td>
                      <td>{client.recommendation.packageName}</td>
                      <td>${client.recommendation.totalToday.toLocaleString()} + ${client.recommendation.monthlyDue}/mo</td>
                      <td><span className="status-pill">{client.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article className="admin-panel">
              <h2><ClipboardList size={22} /> Task Queue</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Owner</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {demoTasks.map((task) => (
                    <tr key={task.id}>
                      <td>{task.title}<br /><span className="muted">{task.client}</span></td>
                      <td>{task.owner}</td>
                      <td><span className="status-pill">{task.due}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
