export type TipoFormato = "llaveros" | "pulseras";

interface Socio {
  numeroSocio: string;
  nombre: string;
  apellido1: string | null;
  apellido2: string | null;
  qrToken: string;
}

interface Medidas {
  cardW: number;
  cardH: number;
  cols: number;
  rows: number;
  gap: number;
  marginLeft: number;
  marginTop: number;
  qrSize: number;
  qrX: number;
  qrY: number;
  textX: number;
  textY: number;
  textW: number;
  textH: number;
  holeDiam: number;
  holeX: number;
}

function calcularMargenes(cardW: number, cardH: number, cols: number, rows: number, gap: number) {
  const pageW = 210;
  const pageH = 297;
  const marginLeft = (pageW - cols * cardW - (cols - 1) * gap) / 2;
  const marginTop = (pageH - rows * cardH - (rows - 1) * gap) / 2;
  return { marginLeft, marginTop };
}

const LLAVEROS: Medidas = (() => {
  const cardW = 60, cardH = 25, cols = 3, rows = 8, gap = 3;
  const qrSize = 21;
  const qrX = 8;
  const qrY = 2;
  const textW = 26.5;
  const textH = 20;
  const textX = 30;
  const textY = 4;
  const holeDiam = 3;
  const holeX = cardW - 5;
  const { marginLeft, marginTop } = calcularMargenes(cardW, cardH, cols, rows, gap);
  return { cardW, cardH, cols, rows, gap, marginLeft, marginTop, qrSize, qrX, qrY, textX, textY, textW, textH, holeDiam, holeX };
})();

const PULSERAS: Medidas = (() => {
  const cardW = 50, cardH = 19, cols = 3, rows = 13, gap = 3;
  const qrSize = 17;
  const qrX = 2;
  const qrY = (cardH - qrSize) / 2;
  const textW = 20;
  const textH = 15;
  const textX = qrX + qrSize + 2.5;
  const textY = (cardH - textH) / 2;
  const holeDiam = 0;
  const holeX = 0;
  const { marginLeft, marginTop } = calcularMargenes(cardW, cardH, cols, rows, gap);
  return { cardW, cardH, cols, rows, gap, marginLeft, marginTop, qrSize, qrX, qrY, textX, textY, textW, textH, holeDiam, holeX };
})();

export function getMedidas(formato: TipoFormato): Medidas {
  return formato === "llaveros" ? LLAVEROS : PULSERAS;
}

export function getSociosPorPagina(formato: TipoFormato): number {
  const m = getMedidas(formato);
  return m.cols * m.rows;
}

export function getNombreArchivo(formato: TipoFormato, numeroSocio?: string): string {
  const prefijo = formato === "llaveros" ? "llavero" : "pulsera";
  return numeroSocio ? `${prefijo}-${numeroSocio}.png` : `${prefijo}s-qr.pdf`;
}

export function obtenerTextos(socio: Socio): string[] {
  const lineas = [`Nº ${socio.numeroSocio}`, socio.nombre];

  if (socio.apellido1) lineas.push(socio.apellido1);
  if (socio.apellido2) lineas.push(socio.apellido2);

  return lineas;}

function getPosicionEtiqueta(index: number, medidas: Medidas) {
  const col = index % medidas.cols;
  const row = Math.floor(index / medidas.cols);
  const x = medidas.marginLeft + col * (medidas.cardW + medidas.gap);
  const y = medidas.marginTop + row * (medidas.cardH + medidas.gap);
  return { x, y };
}

export function calcularFontSize(
  textos: string[],
  anchoMaxMm: number,
  altoMaxMm: number,
  medirTexto: (texto: string, tamano: number) => number
): number {
  const ptToMm = 0.353;
  let fontSize = 12;
  const lineSpacing = 0.5;
  for (; fontSize >= 5; fontSize -= 0.5) {
    const lineH = fontSize * ptToMm + lineSpacing;
    const totalAltura = textos.length * lineH;
    let cabe = totalAltura <= altoMaxMm;
    if (cabe) {
      for (const t of textos) {
        if (medirTexto(t, fontSize) > anchoMaxMm) { cabe = false; break; }
      }
    }
    if (cabe) return fontSize;
  }
  return 5;
}

export async function cargarFuenteImpactPDF(doc: any): Promise<void> {
  const resp = await fetch("/fonts/impact.ttf");
  const buffer = await resp.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  doc.addFileToVFS("Impact.ttf", base64);
  doc.addFont("Impact.ttf", "Impact", "normal");
}

function dibujarFondoEtiquetaPDF(doc: any, x: number, y: number, medidas: Medidas): void {
  const lineW = 0.3;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(lineW);

  if (medidas.cardH === LLAVEROS.cardH) {
    const r = medidas.cardH / 2;
    doc.roundedRect(x, y, medidas.cardW, medidas.cardH, r, r);

    if (medidas.holeDiam > 0) {
      const holeR = medidas.holeDiam / 2;
      doc.circle(x + medidas.holeX, y + medidas.cardH / 2, holeR);
    }
  } else {
    doc.rect(x, y, medidas.cardW, medidas.cardH);
  }
}

export async function generarPaginaPDF(
  doc: any,
  formato: TipoFormato,
  socios: Socio[],
  startIndex: number,
  qrModule: any
): Promise<void> {
  const medidas = getMedidas(formato);
  const cardsPerPage = medidas.cols * medidas.rows;

  await cargarFuenteImpactPDF(doc);

  for (let i = 0; i < cardsPerPage; i++) {
    const socioIdx = startIndex + i;
    if (socioIdx >= socios.length) break;

    const socio = socios[socioIdx];
    const pos = getPosicionEtiqueta(i, medidas);

    if (i === 0) {
      dibujarFondoEtiquetaPDF(doc, pos.x, pos.y, medidas);
    } else {
      dibujarFondoEtiquetaPDF(doc, pos.x, pos.y, medidas);
    }

    const qrUrl = `${window.location.origin}/scanner/result?token=${socio.qrToken}`;
    const qrDataUrl = await qrModule.default.toDataURL(qrUrl, {
      width: 250,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    const qrClampY = Math.max(0, pos.y + medidas.qrY);
    const qrClampH = Math.min(medidas.qrSize, pos.y + medidas.cardH - qrClampY);
    if (qrClampH > 0) {
      doc.addImage(qrDataUrl, "PNG", pos.x + medidas.qrX, qrClampY, medidas.qrSize, qrClampH, undefined, "FAST");
    }

    const textos = obtenerTextos(socio);
    const medirTexto = (texto: string, tam: number): number => {
      doc.setFont("Impact", "normal");
      doc.setFontSize(tam);
      return doc.getTextWidth(texto) * 0.85;
    };

    const fontSize = calcularFontSize(textos, medidas.textW, medidas.textH, medirTexto);
    const ptToMm = 0.353;
    const lineSpacing = 0.5;

    doc.setFont("Impact", "normal");
    doc.setFontSize(fontSize);

    let textY = pos.y + medidas.textY + fontSize * ptToMm;
    for (const texto of textos) {
      if (!texto) continue;
      doc.text(texto, pos.x + medidas.textX, textY);
      textY += fontSize * ptToMm + lineSpacing;
    }
  }
}

const FILADA_ROWS = 5;

export function getSociosPorPaginaFilada(formato: TipoFormato): number {
  const m = getMedidas(formato);
  const maxCols = Math.floor((210 + m.gap) / (m.cardW + m.gap));
  return FILADA_ROWS * maxCols;
}

export async function generarPaginaPDFFilada(
  doc: any,
  formato: TipoFormato,
  socios: Socio[],
  startIndex: number,
  qrModule: any,
  filadaNombre: string | null
): Promise<void> {
  const m = getMedidas(formato);
  const pageW = 210;
  const pageH = 297;
  const itemsOnPage = Math.min(socios.length - startIndex, getSociosPorPaginaFilada(formato));
  const cols = Math.ceil(itemsOnPage / FILADA_ROWS);
  const marginLeft = (pageW - cols * m.cardW - (cols - 1) * m.gap) / 2;
  const totalH = FILADA_ROWS * m.cardH + (FILADA_ROWS - 1) * m.gap;
  const marginTop = Math.max(16, (pageH - totalH) / 2);

  await cargarFuenteImpactPDF(doc);

  if (filadaNombre) {
    doc.setFont("Impact", "normal");
    doc.setFontSize(11);
    doc.text(filadaNombre, marginLeft, marginTop - 5);
  }

  for (let i = 0; i < itemsOnPage; i++) {
    const socioIdx = startIndex + i;
    const socio = socios[socioIdx];
    const col = Math.floor(i / FILADA_ROWS);
    const row = i % FILADA_ROWS;
    const x = marginLeft + col * (m.cardW + m.gap);
    const y = marginTop + row * (m.cardH + m.gap);

    dibujarFondoEtiquetaPDF(doc, x, y, m);

    const qrUrl = `${window.location.origin}/scanner/result?token=${socio.qrToken}`;
    const qrDataUrl = await qrModule.default.toDataURL(qrUrl, {
      width: 250,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    const qrClampY = Math.max(0, y + m.qrY);
    const qrClampH = Math.min(m.qrSize, y + m.cardH - qrClampY);
    if (qrClampH > 0) {
      doc.addImage(qrDataUrl, "PNG", x + m.qrX, qrClampY, m.qrSize, qrClampH, undefined, "FAST");
    }

    const textos = obtenerTextos(socio);
    const textX = x + m.qrX + m.qrSize + 0.5;
    const textY = y + m.textY;
    const anchoDisp = m.cardW - m.qrX - m.qrSize - 0.5;
    const altoDisp = m.cardH - m.qrY - 0.5;

    const medirTexto = (t: string, tam: number): number => {
      doc.setFont("Impact", "normal");
      doc.setFontSize(tam);
      return doc.getTextWidth(t) * 0.85;
    };

    const fontSize = Math.max(5, calcularFontSize(textos, anchoDisp, altoDisp, medirTexto) - 1);
    doc.setFont("Impact", "normal");
    doc.setFontSize(fontSize);

    for (let li = 0; li < textos.length; li++) {
      if (!textos[li]) continue;
      doc.text(textos[li], textX, textY + li * (fontSize * 0.353 + 1.5));
    }
  }
}

export async function generarEtiquetaPNG(
  formato: TipoFormato,
  socio: Socio,
  dpi: number = 300
): Promise<string> {
  const medidas = getMedidas(formato);
  const mmToPx = dpi / 25.4;
  const canvasW = Math.round(medidas.cardW * mmToPx);
  const canvasH = Math.round(medidas.cardH * mmToPx);

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d")!;
  const lineW = Math.max(1, mmToPx * 0.3);

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvasW, canvasH);

  if (formato === "llaveros") {
    const r = canvasH / 2;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(canvasW - r, 0);
    ctx.arcTo(canvasW, 0, canvasW, canvasH, r);
    ctx.arcTo(canvasW, canvasH, 0, canvasH, r);
    ctx.arcTo(0, canvasH, 0, 0, r);
    ctx.arcTo(0, 0, canvasW, 0, r);
    ctx.closePath();
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = lineW;
    ctx.stroke();

    if (medidas.holeDiam > 0) {
      const holeR = (medidas.holeDiam / 2) * mmToPx;
      const holeCx = medidas.holeX * mmToPx;
      const holeCy = canvasH / 2;
      ctx.beginPath();
      ctx.arc(holeCx, holeCy, holeR, 0, Math.PI * 2);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = lineW;
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = lineW;
    ctx.strokeRect(lineW / 2, lineW / 2, canvasW - lineW, canvasH - lineW);
  }

  const qrModule = await import("qrcode");
  const qrUrl = `${window.location.origin}/scanner/result?token=${socio.qrToken}`;
  const qrDataUrl = await qrModule.default.toDataURL(qrUrl, {
    width: 300,
    margin: 0,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  const qrImg = new Image();
  qrImg.src = qrDataUrl;
  await new Promise((resolve) => { qrImg.onload = resolve; });

  const qrPx = Math.round(medidas.qrSize * mmToPx);
  const qrPxY = Math.round(medidas.qrY * mmToPx);
  ctx.drawImage(qrImg, Math.round(medidas.qrX * mmToPx), qrPxY, qrPx, qrPx);

  const textos = obtenerTextos(socio);
  const medirTexto = (texto: string, tamPt: number): number => {
    const tamPx = tamPt * dpi / 72;
    ctx.font = `bold ${tamPx}px Impact`;
    return ctx.measureText(texto).width / mmToPx * 1.15;
  };

  const fontSizePt = calcularFontSize(textos, medidas.textW, medidas.textH, medirTexto);
  const fontSizePx = fontSizePt * dpi / 72;
  const lineSpacingPx = 2;
  const lineH = fontSizePx + lineSpacingPx;

  ctx.font = `bold ${fontSizePx}px Impact`;
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";

  let textY = Math.round(medidas.textY * mmToPx);
  for (const texto of textos) {
    if (!texto) continue;
    ctx.fillText(texto, Math.round(medidas.textX * mmToPx), textY);
    textY += lineH;
  }

  return canvas.toDataURL("image/png");
}
