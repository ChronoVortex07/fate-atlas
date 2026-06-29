import html2canvas from 'html2canvas';

// 380×475 logical → ~1080×1350 (4:5). Capture at a scale that hits the target.
export async function exportShareCard(element: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(element, { backgroundColor: '#05070e', scale: 1080 / 380, width: 380, height: 475 });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))), 'image/png');
  });
}

export async function shareCard(element: HTMLElement): Promise<void> {
  const blob = await exportShareCard(element);
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], 'atlas-of-fate-reading.png', { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Atlas of Fate Reading' });
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'atlas-of-fate-reading.png'; a.click();
  URL.revokeObjectURL(url);
}

