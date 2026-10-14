export interface ViolationExplanation {
  title: string;
  actionDone: string; // What violation was done by candidate during the exam
  ruleBreached: string;
  defaultSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'AI_VISION' | 'BROWSER_SECURITY' | 'DEVICE_INTEGRITY';
}

export const VIOLATION_DETAILS: Record<string, ViolationExplanation> = {
  MULTIPLE_FACES: {
    title: 'Multiple Faces Detected',
    actionDone: 'Multiple individuals were detected in the camera frame simultaneously. The candidate was not alone or had another person assisting them in front of the screen during the exam.',
    ruleBreached: 'Single-Candidate Policy: Only the registered candidate is permitted in the examination area.',
    defaultSeverity: 'CRITICAL',
    category: 'AI_VISION'
  },
  FACE_NOT_FOUND: {
    title: 'Candidate Face Not In Camera View',
    actionDone: 'Candidate\'s face was not detected in the camera feed. The candidate turned away from the screen, covered the webcam lens, or left the examination seat.',
    ruleBreached: 'Continuous Presence Rule: Candidate must remain seated and facing the camera throughout the entire examination.',
    defaultSeverity: 'CRITICAL',
    category: 'AI_VISION'
  },
  NO_FACE_DETECTED: {
    title: 'No Face Detected In Frame',
    actionDone: 'No face was identified in the webcam video stream. The candidate turned away, obstructed the camera, or stepped away from the desk.',
    ruleBreached: 'Continuous Presence Rule: Face must remain clearly visible at all times during the test.',
    defaultSeverity: 'CRITICAL',
    category: 'AI_VISION'
  },
  TAB_SWITCH: {
    title: 'Browser Tab Switched',
    actionDone: 'Candidate switched away from the examination tab to another browser tab or window, attempting to search answers or browse external websites during the exam.',
    ruleBreached: 'Strict Single-Tab Policy: Navigating away from the active exam tab is strictly prohibited.',
    defaultSeverity: 'CRITICAL',
    category: 'BROWSER_SECURITY'
  },
  WINDOW_FOCUS_LOST: {
    title: 'Exam Window Lost Focus',
    actionDone: 'The examination window lost active system focus. The candidate clicked into an external program, desktop application, or background tool during the exam.',
    ruleBreached: 'Active Window Focus: The exam browser must remain the focused application at all times.',
    defaultSeverity: 'CRITICAL',
    category: 'BROWSER_SECURITY'
  },
  FULLSCREEN_EXIT: {
    title: 'Exited Fullscreen Mode',
    actionDone: 'Candidate exited secure full-screen examination mode, attempting to access system taskbars, browsers, or split-screen views.',
    ruleBreached: 'Fullscreen Lock: The exam must be taken in dedicated full-screen mode to prevent multi-tasking.',
    defaultSeverity: 'CRITICAL',
    category: 'BROWSER_SECURITY'
  },
  WINDOW_CLOSED: {
    title: 'Exam Window Closed / Terminated',
    actionDone: 'Candidate closed the examination browser window or tab prematurely while the exam was in progress without formally submitting.',
    ruleBreached: 'Continuous Active Session Rule: The exam window must remain active and focused until formal submission.',
    defaultSeverity: 'CRITICAL',
    category: 'BROWSER_SECURITY'
  },
  EXAM_ABANDONED: {
    title: 'Exam Session Abandoned',
    actionDone: 'Candidate disconnected or navigated away from the exam session without completing the examination.',
    ruleBreached: 'Continuous Session Rule: Candidate must complete and submit the exam within the active session.',
    defaultSeverity: 'CRITICAL',
    category: 'BROWSER_SECURITY'
  },
  SCREEN_SHARE_STOPPED: {
    title: 'Screen Share Stopped',
    actionDone: 'Candidate halted or revoked the required live screen sharing broadcast prior to completing and submitting the examination.',
    ruleBreached: 'Mandatory Screen Telemetry: Live screen share must remain active until exam submission.',
    defaultSeverity: 'CRITICAL',
    category: 'BROWSER_SECURITY'
  },
  COPY_PASTE: {
    title: 'Copy / Paste Action Attempted',
    actionDone: 'Candidate attempted to copy test questions to the clipboard or paste external content into the answer fields.',
    ruleBreached: 'Anti-Plagiarism Protection: Copying exam questions or pasting outside text is forbidden.',
    defaultSeverity: 'HIGH',
    category: 'BROWSER_SECURITY'
  },
  COPY_PASTE_ATTEMPT: {
    title: 'Copy / Paste Action Attempted',
    actionDone: 'Candidate attempted to copy test questions to the clipboard or paste external content into the answer fields.',
    ruleBreached: 'Anti-Plagiarism Protection: Copying exam questions or pasting outside text is forbidden.',
    defaultSeverity: 'HIGH',
    category: 'BROWSER_SECURITY'
  },
  LOOKING_AWAY: {
    title: 'Gaze Aversion / Looking Away',
    actionDone: 'Candidate repeatedly diverted their gaze away from the examination monitor towards unauthorized notes, external devices, or another individual.',
    ruleBreached: 'Direct Screen Gaze: Candidate must maintain visual focus on the exam screen.',
    defaultSeverity: 'HIGH',
    category: 'AI_VISION'
  },
  UNAUTHORIZED_DEVICE: {
    title: 'Unauthorized External Device Detected',
    actionDone: 'An auxiliary monitor, external display, or unauthorized peripheral device was connected to the candidate workstation during the exam.',
    ruleBreached: 'Single-Display Environment: Multi-monitor and secondary display setups are prohibited.',
    defaultSeverity: 'CRITICAL',
    category: 'DEVICE_INTEGRITY'
  },
  MOBILE_PHONE_DETECTED: {
    title: 'Mobile Phone / Electronic Device Detected',
    actionDone: 'Candidate was detected holding or using an electronic device (mobile phone or camera) and attempting to take photographs of the examination screen or browse prohibited materials.',
    ruleBreached: 'Strict No-Electronic-Device Policy: Mobile phones, electronic recording devices, and photographing the screen are strictly prohibited during the exam.',
    defaultSeverity: 'CRITICAL',
    category: 'AI_VISION'
  },
  PROHIBITED_OBJECT: {
    title: 'Prohibited Device in Exam Area',
    actionDone: 'A forbidden physical device or smartphone was detected in candidate view or pointed towards the monitor.',
    ruleBreached: 'Clean Desk Policy: All electronic devices must remain completely outside the examination area.',
    defaultSeverity: 'CRITICAL',
    category: 'AI_VISION'
  },
  ELECTRONIC_DEVICE_DETECTED: {
    title: 'Electronic Device Detected',
    actionDone: 'Candidate was observed using an unauthorized electronic device during the examination session.',
    ruleBreached: 'Prohibited Device Rule: No secondary electronic devices are permitted during test sessions.',
    defaultSeverity: 'CRITICAL',
    category: 'DEVICE_INTEGRITY'
  }
};

export function getViolationInfo(type: string = '', description?: string): {
  title: string;
  actionDone: string;
  ruleBreached: string;
  severityDefault: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  categoryLabel: string;
  customNote?: string;
} {
  const normType = type.trim().toUpperCase();
  const entry = VIOLATION_DETAILS[normType];

  if (entry) {
    return {
      title: entry.title,
      actionDone: entry.actionDone,
      ruleBreached: entry.ruleBreached,
      severityDefault: entry.defaultSeverity,
      categoryLabel: entry.category === 'AI_VISION' 
        ? 'AI Webcam Surveillance' 
        : entry.category === 'BROWSER_SECURITY' 
          ? 'Browser Sandbox & Focus' 
          : 'Hardware & System Integrity',
      customNote: description && description !== entry.actionDone ? description : undefined
    };
  }

  // Fallback for custom or unmapped types
  const formattedTitle = (type || 'PROCTOR_FLAG').replace(/_/g, ' ');
  return {
    title: formattedTitle.charAt(0).toUpperCase() + formattedTitle.slice(1).toLowerCase(),
    actionDone: description || `Candidate triggered an automated ${formattedTitle.toLowerCase()} security flag during the examination.`,
    ruleBreached: 'Standard Academic Integrity & Secure Examination Conduct Guidelines.',
    severityDefault: 'HIGH',
    categoryLabel: 'Security Telemetry Monitor',
    customNote: description
  };
}
