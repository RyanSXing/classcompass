/** Present explicit teaching fields without inventing or discarding instructions. */
export function teachingParts(description: string) {
  const lines = description.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const fields = lines.map((line) => /^(Time|With|Do|Check):\s*(.+)$/i.exec(line));
  if (lines.length > 1 && fields.every(Boolean)) {
    const values = (name: string) => fields.filter((field) => field![1].toLowerCase() === name).map((field) => field![2]);
    return { time: values('time').join(' · '), who: values('with').join(', '), steps: values('do'), check: values('check').join(' '), structured: true };
  }
  // Existing saved suggestions use a leading duration and a trailing success check.
  const duration = /^(\d+(?:[–-]\d+)?\s*min(?:utes)?)\.\s*/i.exec(description);
  const body = duration ? description.slice(duration[0].length) : description;
  const check = /\s+(?:Success check|Success):\s*/i.exec(body);
  return {
    time: duration?.[1] ?? '', who: '',
    steps: [check ? body.slice(0, check.index).trim() : body.trim()].filter(Boolean),
    check: check ? body.slice(check.index + check[0].length).trim() : '',
    structured: !!duration || !!check,
  };
}
