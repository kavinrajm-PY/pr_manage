/**
 * Triggers the /api/send-email App Router endpoint to send a templated notification.
 */
async function callSendEmailApi(to: string, slug: string, details: Record<string, any>): Promise<void> {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, slug, details }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Email sending failed: ${errText}`);
    }
  } catch (error) {
    console.error('Failed to send email notification:', error);
    // We log and fail-silent so that email service issues do not break the core UI operations
  }
}

/**
 * Send new project assignment email to Team Lead
 */
export async function sendNewProjectTLNotification(params: {
  email: string;
  fullName: string;
  projectName: string;
  projectDescription: string;
  startDate: string;
  deadline: string;
  teamLeadName: string;
}): Promise<void> {
  const { email, fullName, projectName, projectDescription, startDate, deadline, teamLeadName } = params;
  return callSendEmailApi(email, 'pymanage-projecttl', {
    fullName,
    projectName,
    projectDescription: projectDescription || 'No description provided.',
    startDate,
    deadline,
    teamLead: teamLeadName,
  });
}

/**
 * Send new project assignment email to Team Member
 */
export async function sendNewProjectTMNotification(params: {
  email: string;
  fullName: string;
  projectName: string;
  projectDescription: string;
  startDate: string;
  deadline: string;
  teamLeadName: string;
}): Promise<void> {
  const { email, fullName, projectName, projectDescription, startDate, deadline, teamLeadName } = params;
  return callSendEmailApi(email, 'pymanage-projecttm', {
    fullName,
    projectName,
    projectDescription: projectDescription || 'No description provided.',
    startDate,
    deadline,
    teamLead: teamLeadName,
  });
}

/**
 * Send task assignment email to Team Member
 */
export async function sendTaskAssignedNotification(params: {
  email: string;
  fullName: string;
  taskTitle: string;
  taskDescription: string;
  projectName: string;
  createdDate: string;
  deadline: string;
  createdByName: string;
}): Promise<void> {
  const { email, fullName, taskTitle, taskDescription, projectName, createdDate, deadline, createdByName } = params;
  return callSendEmailApi(email, 'pymanage-tasks', {
    fullName,
    taskTitle,
    taskDescription: taskDescription || 'No description provided.',
    projectName,
    createdDate,
    deadline,
    createdBy: createdByName,
  });
}
