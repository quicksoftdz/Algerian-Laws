import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Message, ChatSession } from '../types/chat';
import { calculateApproximateTokens, formatApproximateTokens } from '../lib/tokenEstimator';
import { formatTimeHHMM } from '../components/ChatMessageList';

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Scans canvas pixels upwards from candidate targetY to locate a clean blank horizontal band
 * (padding/margin between paragraphs, headings, list items, or code lines), preventing
 * sliced letters or cut elements across page breaks.
 */
function findCleanSlicePoint(
  canvas: HTMLCanvasElement,
  sourceY: number,
  targetY: number
): number {
  if (targetY >= canvas.height) {
    return canvas.height;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return targetY;

  // Search window: inspect up to 25% of the page height above targetY
  const maxSearchDistance = (targetY - sourceY) * 0.25;
  const minY = Math.max(sourceY + 40, targetY - maxSearchDistance);
  const searchHeight = Math.floor(targetY - minY);
  if (searchHeight <= 5) return targetY;

  try {
    const imgData = ctx.getImageData(0, Math.floor(minY), canvas.width, searchHeight);
    const data = imgData.data;
    const width = canvas.width;
    const step = 4; // Check every 4th horizontal pixel for high performance

    // Scan upwards from targetY towards minY
    for (let row = searchHeight - 1; row >= 0; row--) {
      let contentPixels = 0;
      const rowOffset = row * width * 4;

      for (let col = 0; col < width; col += step) {
        const pIdx = rowOffset + col * 4;
        const r = data[pIdx];
        const g = data[pIdx + 1];
        const b = data[pIdx + 2];
        const a = data[pIdx + 3];

        // Content pixel detection: not white/transparent and has darker content
        if (a > 30 && (r < 235 || g < 235 || b < 235)) {
          contentPixels++;
          if (contentPixels > (width / step) * 0.015) {
            break;
          }
        }
      }

      // If almost no content pixels in this row, it is clean white vertical spacing
      if (contentPixels <= (width / step) * 0.015) {
        return Math.floor(minY + row);
      }
    }
  } catch (err) {
    console.warn('Canvas slice point detection fallback:', err);
  }

  return targetY;
}

/**
 * Exports ONLY selected AI response cards to a clean, beautifully formatted PDF.
 * - Extracts and renders only the selected response elements (no sidebar, no headers, no unselected messages, no checkboxes, no action bars).
 * - Preserves complete formatting: rich markdown, syntax-highlighted code blocks, tables, images, and Arabic RTL text.
 * - Injects clean page breaks between multiple selected response cards.
 * - Ensures long responses flow correctly across pages with natural break-point detection and continuation headers.
 * - Strictly maintains conversational order.
 */
export async function exportSelectedResponsesToPDF(
  selectedMessages: Message[],
  session: ChatSession | null,
  activeModelName?: string,
  allSessionMessages?: Message[]
): Promise<boolean> {
  if (!selectedMessages || selectedMessages.length === 0) {
    return false;
  }

  // Strictly maintain conversational order as presented in the chat history
  const conversationMessages = allSessionMessages || session?.messages || [];
  const sortedMessages = [...selectedMessages].sort((a, b) => {
    if (conversationMessages.length > 0) {
      const idxA = conversationMessages.findIndex((m) => m.id === a.id);
      const idxB = conversationMessages.findIndex((m) => m.id === b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    }
    return a.timestamp - b.timestamp;
  });

  // Create isolated off-screen staging container
  const stagingContainer = document.createElement('div');
  stagingContainer.id = 'pdf-export-staging-container';
  stagingContainer.style.position = 'fixed';
  stagingContainer.style.left = '-9999px';
  stagingContainer.style.top = '0';
  stagingContainer.style.width = '794px'; // 210mm A4 width at 96 DPI
  stagingContainer.style.zIndex = '-9999';
  stagingContainer.style.backgroundColor = '#ffffff';
  stagingContainer.style.color = '#18181b';
  stagingContainer.style.boxSizing = 'border-box';
  stagingContainer.style.padding = '0';
  stagingContainer.style.margin = '0';

  // Inject document-level export stylesheet
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .pdf-export-wrapper {
      width: 794px;
      background-color: #ffffff;
      color: #18181b;
      padding: 36px 40px;
      box-sizing: border-box;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .pdf-export-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid #e4e4e7;
      padding-bottom: 14px;
      margin-bottom: 24px;
    }
    .pdf-export-body {
      font-size: 14.5px;
      line-height: 1.7;
      color: #18181b;
      word-wrap: break-word;
    }
    .pdf-export-body p {
      margin-bottom: 14px;
      color: #18181b;
    }
    .pdf-export-body h1, .pdf-export-body h2, .pdf-export-body h3, .pdf-export-body h4 {
      color: #09090b;
      font-weight: 700;
      margin-top: 20px;
      margin-bottom: 10px;
      line-height: 1.35;
    }
    .pdf-export-body h1 { font-size: 20px; border-bottom: 1px solid #f4f4f5; padding-bottom: 6px; }
    .pdf-export-body h2 { font-size: 17px; }
    .pdf-export-body h3 { font-size: 15px; }
    .pdf-export-body pre {
      background-color: #f8fafc !important;
      color: #0f172a !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 8px !important;
      padding: 14px 18px !important;
      margin: 16px 0 !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace !important;
      font-size: 12px !important;
      line-height: 1.5 !important;
      white-space: pre-wrap !important;
      word-break: break-word !important;
      direction: ltr !important;
      text-align: left !important;
      overflow: visible !important;
    }
    .pdf-export-body code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      font-size: 12.5px;
    }
    .pdf-export-body p code, .pdf-export-body li code {
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
      direction: ltr;
      display: inline-block;
    }
    .pdf-export-body table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 18px 0 !important;
      font-size: 13px !important;
    }
    .pdf-export-body th {
      background-color: #f1f5f9 !important;
      color: #1e293b !important;
      font-weight: 600 !important;
      padding: 9px 12px !important;
      border: 1px solid #cbd5e1 !important;
    }
    .pdf-export-body td {
      padding: 8px 12px !important;
      border: 1px solid #cbd5e1 !important;
      color: #334155 !important;
    }
    .pdf-export-body blockquote {
      border-left: 4px solid #9333ea !important;
      padding: 8px 16px !important;
      margin: 16px 0 !important;
      background-color: #faf5ff !important;
      color: #4b5563 !important;
      font-style: italic !important;
      border-radius: 0 6px 6px 0 !important;
    }
    .pdf-export-body[dir="rtl"] blockquote {
      border-left: none !important;
      border-right: 4px solid #9333ea !important;
      border-radius: 6px 0 0 6px !important;
    }
    .pdf-export-body ul, .pdf-export-body ol {
      margin: 12px 0 16px 0;
      padding-left: 24px;
    }
    .pdf-export-body[dir="rtl"] ul, .pdf-export-body[dir="rtl"] ol {
      padding-left: 0;
      padding-right: 24px;
    }
    .pdf-export-body li {
      margin-bottom: 6px;
    }
    .pdf-export-body a {
      color: #7c3aed;
      text-decoration: underline;
    }
    .pdf-export-body img {
      max-width: 100% !important;
      height: auto !important;
      border-radius: 8px !important;
      margin: 12px 0 !important;
      display: block;
    }
    /* Syntax highlighting token colors for clean light print */
    .pdf-export-body .hljs-keyword, .pdf-export-body .hljs-selector-tag { color: #7c3aed !important; font-weight: 600 !important; }
    .pdf-export-body .hljs-string, .pdf-export-body .hljs-regexp { color: #059669 !important; }
    .pdf-export-body .hljs-comment, .pdf-export-body .hljs-quote { color: #64748b !important; font-style: italic !important; }
    .pdf-export-body .hljs-number, .pdf-export-body .hljs-literal { color: #d97706 !important; }
    .pdf-export-body .hljs-title, .pdf-export-body .hljs-section { color: #2563eb !important; font-weight: 600 !important; }
    .pdf-export-body .hljs-variable, .pdf-export-body .hljs-attr { color: #0284c7 !important; }
  `;
  stagingContainer.appendChild(styleEl);
  document.body.appendChild(stagingContainer);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 15; // 15mm margin
  const contentWidth = pageWidth - margin * 2; // 180mm
  const contentHeight = pageHeight - margin * 2 - 12; // 255mm max height leaving space for footer

  try {
    for (let idx = 0; idx < sortedMessages.length; idx++) {
      const msg = sortedMessages[idx];
      const modelName = msg.model || session?.model || activeModelName || 'AI Assistant';
      const msgTime = formatTimeHHMM(msg.timestamp);
      const isRtl = /[\u0600-\u06FF]/.test(msg.content);

      // Locate response card DOM element
      const cardEl =
        document.querySelector<HTMLElement>(`[data-response-card="${msg.id}"]`) ||
        document.querySelector<HTMLElement>(`[data-message-id="${msg.id}"]`);

      const cardWrapper = document.createElement('div');
      cardWrapper.className = 'pdf-export-wrapper';

      // Header block
      const headerEl = document.createElement('div');
      headerEl.className = 'pdf-export-header';
      headerEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 28px; height: 28px; border-radius: 8px; background-color: #f4f4f5; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; color: #7c3aed; border: 1px solid #e4e4e7;">
            AI
          </div>
          <div>
            <div style="font-weight: 700; font-size: 15px; color: #18181b; line-height: 1.2;">${escapeHtml(modelName)}</div>
            <div style="font-size: 11px; color: #71717a; margin-top: 2px;">
              ${sortedMessages.length > 1 ? `Selected Response ${idx + 1} of ${sortedMessages.length}  •  ` : ''}${msgTime}
            </div>
          </div>
        </div>
        <div style="font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 9999px; background-color: #f4f4f5; color: #52525b; border: 1px solid #e4e4e7; font-family: monospace;">
          AI Response
        </div>
      `;
      cardWrapper.appendChild(headerEl);

      // Body content clone
      const bodyEl = document.createElement('div');
      bodyEl.className = 'pdf-export-body';
      bodyEl.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
      bodyEl.style.textAlign = isRtl ? 'right' : 'left';

      if (cardEl) {
        const textContainer = cardEl.querySelector('.chat-message-text') || cardEl;
        const clone = textContainer.cloneNode(true) as HTMLElement;

        // Strip UI controls (checkboxes, action bars, copy buttons, avatars)
        clone.querySelectorAll('[data-export-ignore="true"]').forEach((el) => el.remove());
        clone.querySelectorAll('button').forEach((el) => el.remove());

        // Strip any focus/selection ring styling
        clone.classList.remove('ring-2', 'ring-purple-500', 'border-purple-500');
        clone.style.backgroundColor = 'transparent';
        clone.style.boxShadow = 'none';
        clone.style.border = 'none';

        bodyEl.appendChild(clone);
      } else {
        // Fallback: render basic paragraphs if DOM element was not yet in tree
        const fallbackP = document.createElement('p');
        fallbackP.textContent = msg.content;
        bodyEl.appendChild(fallbackP);
      }

      cardWrapper.appendChild(bodyEl);

      // Mount into staging container
      stagingContainer.appendChild(cardWrapper);

      // Wait for any embedded images inside the card to load
      const images = Array.from(cardWrapper.querySelectorAll('img'));
      if (images.length > 0) {
        await Promise.all(
          images.map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete && img.naturalHeight !== 0) {
                  resolve();
                } else {
                  img.onload = () => resolve();
                  img.onerror = () => resolve();
                  setTimeout(resolve, 2000);
                }
              })
          )
        );
      }

      // Capture with html2canvas at 2x resolution
      const canvas = await html2canvas(cardWrapper, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 794,
      });

      // Remove card wrapper from staging DOM
      cardWrapper.remove();

      // Paginate into jsPDF
      const ratio = contentWidth / canvas.width;
      const renderedHeightMm = canvas.height * ratio;

      // Clean page break before each subsequent selected response card
      if (idx > 0) {
        doc.addPage();
      }

      if (renderedHeightMm <= contentHeight) {
        // Fits entirely on one page
        doc.addImage(
          canvas.toDataURL('image/jpeg', 0.95),
          'JPEG',
          margin,
          margin,
          contentWidth,
          renderedHeightMm
        );
      } else {
        // Long response spanning multiple pages: slice canvas cleanly at text line boundaries
        let sourceY = 0;
        let pageIdx = 0;

        while (sourceY < canvas.height) {
          if (pageIdx > 0) {
            // Inject clean page break for continuing long response
            doc.addPage();

            // Render subtle continuation header on subsequent pages of this response
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(113, 113, 122);
            const contText = `${modelName} (Continued)  •  Response ${idx + 1} of ${sortedMessages.length}`;
            doc.text(contText, margin, margin + 4);

            doc.setDrawColor(228, 228, 231);
            doc.setLineWidth(0.2);
            doc.line(margin, margin + 6, margin + contentWidth, margin + 6);
          }

          const yPosOnPage = pageIdx === 0 ? margin : margin + 9;
          const availableHeightMm =
            pageIdx === 0
              ? contentHeight
              : pageHeight - (margin + 9) - margin - 12;

          const pxPerPage = availableHeightMm / ratio;
          const idealTargetY = Math.min(canvas.height, sourceY + pxPerPage);

          // Find natural whitespace break point so text/code/tables are never cut in half
          const cleanSliceY =
            idealTargetY >= canvas.height
              ? canvas.height
              : findCleanSlicePoint(canvas, sourceY, idealTargetY);

          const sliceHeightPx = Math.max(10, cleanSliceY - sourceY);
          const sliceHeightMm = sliceHeightPx * ratio;

          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceHeightPx;
          const ctx = sliceCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            ctx.drawImage(
              canvas,
              0,
              sourceY,
              canvas.width,
              sliceHeightPx,
              0,
              0,
              canvas.width,
              sliceHeightPx
            );
            doc.addImage(
              sliceCanvas.toDataURL('image/jpeg', 0.95),
              'JPEG',
              margin,
              yPosOnPage,
              contentWidth,
              sliceHeightMm
            );
          }

          sourceY += sliceHeightPx;
          pageIdx++;
        }
      }
    }

    // Add page footers to all pages
    const totalPages = doc.internal.pages.length - 1;
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 155);
      doc.setDrawColor(228, 228, 231);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
      doc.text('AI Studio • Selected AI Response Document', margin, pageHeight - 7);
      const pageStr = `Page ${p} of ${totalPages}`;
      doc.text(pageStr, margin + contentWidth - doc.getTextWidth(pageStr), pageHeight - 7);
    }

    // Meaningful filename
    const dateStr = new Date().toISOString().slice(0, 10);
    let filename = 'ai-response.pdf';
    if (sortedMessages.length > 1) {
      filename = `selected-ai-responses-${dateStr}.pdf`;
    } else {
      const titlePart = session?.title
        ? session.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 24)
        : 'ai';
      filename = `${titlePart}-response-${dateStr}.pdf`;
    }

    doc.save(filename);
    return true;
  } finally {
    // Guaranteed cleanup of staging container
    stagingContainer.remove();
  }
}

/**
 * Generates a clean, beautifully formatted PDF document of the entire conversation history using jsPDF.
 */
export async function exportChatToPDF(
  session: ChatSession | null,
  messages: Message[],
  activeModelName?: string
): Promise<boolean> {
  if (!messages || messages.length === 0) {
    return false;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 16; // 16mm margin
  const contentWidth = pageWidth - margin * 2; // 178mm
  const bottomMargin = 20;

  let currentY = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = margin + 4;
      return true;
    }
    return false;
  };

  const title = session?.title || 'AI Chat Conversation';
  const modelName = session?.model || activeModelName || 'AI Model';
  const exportDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const exportTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalTokens = messages.reduce(
    (acc, m) => acc + calculateApproximateTokens(m.content),
    0
  );

  // ----------------------------------------------------
  // Document Header
  // ----------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(24, 24, 27); // neutral-900

  const splitTitle = doc.splitTextToSize(title, contentWidth);
  doc.text(splitTitle, margin, currentY + 4);
  currentY += splitTitle.length * 7 + 2;

  // Metadata subline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122); // neutral-500
  const metaText = `Exported: ${exportDate} at ${exportTime}  |  Model: ${modelName}  |  ${messages.length} messages  |  ~${totalTokens.toLocaleString()} tokens`;
  doc.text(metaText, margin, currentY);
  currentY += 6;

  // Divider line
  doc.setDrawColor(228, 228, 231); // #e4e4e7
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, margin + contentWidth, currentY);
  currentY += 8;

  // ----------------------------------------------------
  // Messages List
  // ----------------------------------------------------
  for (let idx = 0; idx < messages.length; idx++) {
    const msg = messages[idx];
    const isUser = msg.role === 'user';
    const roleLabel = isUser ? 'User' : msg.model || modelName || 'Assistant';
    const msgTime = formatTimeHHMM(msg.timestamp);
    const msgTokens = calculateApproximateTokens(msg.content);
    const tokenStr = `~${formatApproximateTokens(msgTokens)}`;

    checkPageBreak(18);

    // Message Header Box / Badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);

    if (isUser) {
      doc.setFillColor(244, 244, 245); // light gray badge
      doc.setTextColor(39, 39, 42); // dark gray
    } else {
      doc.setFillColor(238, 242, 255); // soft indigo/blue tint
      doc.setTextColor(67, 56, 202); // indigo text
    }

    // Role badge pill
    const badgeWidth = doc.getTextWidth(roleLabel) + 6;
    doc.roundedRect(margin, currentY, badgeWidth, 5.5, 1.2, 1.2, 'F');
    doc.text(roleLabel, margin + 3, currentY + 4);

    // Time & Token Count aligned to right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(113, 113, 122);
    const metaRight = `${tokenStr}  •  ${msgTime}`;
    const metaRightWidth = doc.getTextWidth(metaRight);
    doc.text(metaRight, margin + contentWidth - metaRightWidth, currentY + 4);

    currentY += 8.5;

    // Attachments summary if present
    if (msg.attachments && msg.attachments.length > 0) {
      checkPageBreak(6);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const attNames = msg.attachments
        .map((a) => `[${(a.fileExtension || a.type || 'FILE').toUpperCase()}] ${a.name}`)
        .join(', ');
      doc.text(`Attachments: ${attNames}`, margin + 2, currentY);
      currentY += 5;
    }

    // Parse and render content blocks
    const contentParts = msg.content.split(/(```[\s\S]*?```)/g);

    for (const part of contentParts) {
      if (!part.trim()) continue;

      if (part.startsWith('```') && part.endsWith('```')) {
        // Code Block
        const lines = part.slice(3, -3).trim().split('\n');
        const firstLine = lines[0].trim();
        const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
        const language = hasLang ? firstLine : 'CODE';
        const codeBody = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

        doc.setFont('courier', 'normal');
        doc.setFontSize(8);
        const splitCode = doc.splitTextToSize(codeBody, contentWidth - 10);
        const codeBlockHeight = splitCode.length * 3.8 + 8;

        checkPageBreak(Math.min(codeBlockHeight, 35));

        doc.setFillColor(248, 249, 250);
        doc.setDrawColor(228, 228, 231);
        doc.setLineWidth(0.25);
        doc.rect(
          margin,
          currentY,
          contentWidth,
          Math.min(codeBlockHeight, pageHeight - bottomMargin - currentY),
          'FD'
        );

        // Language tag
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(140, 140, 150);
        doc.text(language.toUpperCase(), margin + 3, currentY + 4);

        let codeY = currentY + 7.5;
        for (const codeLine of splitCode) {
          if (codeY > pageHeight - bottomMargin) {
            doc.addPage();
            codeY = margin + 4;
            doc.setFillColor(248, 249, 250);
            doc.rect(margin, codeY - 3, contentWidth, pageHeight - bottomMargin - codeY, 'F');
            doc.setFont('courier', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
          }
          doc.text(codeLine, margin + 4, codeY);
          codeY += 3.8;
        }

        currentY = codeY + 3;
      } else {
        // Regular Text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(39, 39, 42);

        const paragraphs = part.split('\n');
        for (const para of paragraphs) {
          const trimmedPara = para.trim();
          if (!trimmedPara) {
            currentY += 2;
            continue;
          }

          if (trimmedPara.startsWith('>')) {
            const quoteContent = trimmedPara.replace(/^>\s*/, '');
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(75, 85, 99);
            const quoteLines = doc.splitTextToSize(quoteContent, contentWidth - 8);
            checkPageBreak(quoteLines.length * 4.2 + 2);

            doc.setDrawColor(168, 85, 247);
            doc.setLineWidth(0.6);
            doc.line(
              margin + 1,
              currentY - 1,
              margin + 1,
              currentY + quoteLines.length * 4.2 - 2
            );

            for (const qLine of quoteLines) {
              checkPageBreak(4.5);
              doc.text(qLine, margin + 5, currentY);
              currentY += 4.2;
            }
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(39, 39, 42);
            continue;
          }

          if (trimmedPara.startsWith('- ') || trimmedPara.startsWith('* ')) {
            const bulletText = trimmedPara.slice(2);
            const bulletLines = doc.splitTextToSize(bulletText, contentWidth - 6);
            checkPageBreak(bulletLines.length * 4.4 + 1);

            doc.text('•', margin + 2, currentY);
            for (let bIdx = 0; bIdx < bulletLines.length; bIdx++) {
              if (bIdx > 0) checkPageBreak(4.4);
              doc.text(bulletLines[bIdx], margin + 6, currentY);
              currentY += 4.4;
            }
            continue;
          }

          if (trimmedPara.startsWith('#')) {
            const headingText = trimmedPara.replace(/^#+\s*/, '');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(17, 24, 39);
            checkPageBreak(6);
            doc.text(headingText, margin, currentY);
            currentY += 5.2;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(39, 39, 42);
            continue;
          }

          const wrappedLines = doc.splitTextToSize(trimmedPara, contentWidth);
          for (const line of wrappedLines) {
            checkPageBreak(4.5);
            doc.text(line, margin, currentY);
            currentY += 4.4;
          }
          currentY += 1.5;
        }
      }
    }

    currentY += 5;

    if (idx < messages.length - 1) {
      checkPageBreak(4);
      doc.setDrawColor(240, 240, 243);
      doc.setLineWidth(0.2);
      doc.line(margin, currentY, margin + contentWidth, currentY);
      currentY += 6;
    }
  }

  // ----------------------------------------------------
  // Add Footers with Page Numbers to All Pages
  // ----------------------------------------------------
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(161, 161, 170);

    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);

    doc.text('AI Studio • Conversation Transcript', margin, pageHeight - 8);

    const pageStr = `Page ${i} of ${totalPages}`;
    const pageStrWidth = doc.getTextWidth(pageStr);
    doc.text(pageStr, margin + contentWidth - pageStrWidth, pageHeight - 8);
  }

  const cleanTitle =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'chat-transcript';

  doc.save(`${cleanTitle}-${new Date().toISOString().slice(0, 10)}.pdf`);
  return true;
}
