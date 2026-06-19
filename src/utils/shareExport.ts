import html2canvas from 'html2canvas';

export async function exportToImage(element: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#070a12',
    scale: 2,
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create blob'));
    }, 'image/png');
  });
}

export async function shareAsImage(element: HTMLElement): Promise<void> {
  const blob = await exportToImage(element);
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], 'atlas-of-fate-reading.png', { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Atlas of Fate Reading',
      });
      return;
    }
  }
  // Fallback: download the image
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'atlas-of-fate-reading.png';
  a.click();
  URL.revokeObjectURL(url);
}
