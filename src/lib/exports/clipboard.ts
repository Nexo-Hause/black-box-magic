export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API first
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy fallback
    }
  }

  // Fallback for in-app browsers and older environments
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;

    // Prevent scrolling and keep element invisible
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const success = document.execCommand('copy');

    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}
