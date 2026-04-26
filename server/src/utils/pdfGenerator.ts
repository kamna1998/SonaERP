import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { sha256 } from './hash';

/**
 * SonaERP — Professional PDF Generation Engine (Phase 2).
 *
 * Produces three categories of contractual / report PDFs:
 *   - Template A: Contrat de Gré à Gré (direct negotiation, Art. 49 derogation)
 *   - Template B: Contrat sur Appel d'Offres (competitive procurement)
 *   - Audit Trail Report (project / contract dossier complet)
 *
 * Every PDF carries a verification QR code derived from SHA-256(canonical
 * payload) — scanning it returns the exact hash that should match the
 * sealed `sha256Hash` field on the Contract / Avenant record.
 */

const SONATRACH_NAVY = '#0a1628';
const SONATRACH_ORANGE = '#e87722';
const A4_MARGIN = 50;

// ─── Common helpers ─────────────────────────────────────────────────────────

function formatDZD(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

async function renderHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.fillColor(SONATRACH_NAVY);
  doc.rect(0, 0, doc.page.width, 80).fill();

  doc.fillColor('#ffffff');
  doc.font('Helvetica-Bold').fontSize(20).text('SONATRACH', A4_MARGIN, 25);
  doc.font('Helvetica').fontSize(10).text('Société Nationale pour la Recherche, la Production, le Transport, la Transformation et la Commercialisation des Hydrocarbures', A4_MARGIN, 50, { width: 400 });

  doc.fillColor(SONATRACH_ORANGE);
  doc.rect(0, 80, doc.page.width, 4).fill();

  doc.fillColor(SONATRACH_NAVY);
  doc.font('Helvetica-Bold').fontSize(16).text(title, A4_MARGIN, 110);
  doc.font('Helvetica').fontSize(10).fillColor('#666').text(subtitle, A4_MARGIN, 130);

  doc.moveDown(2);
}

async function renderQrFooter(
  doc: PDFKit.PDFDocument,
  payload: string,
  documentRef: string,
  documentHash: string,
) {
  const qrDataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H',
    width: 100,
    margin: 1,
    color: { dark: SONATRACH_NAVY, light: '#ffffff' },
  });

  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
  const footerY = doc.page.height - 130;

  // Footer separator
  doc.strokeColor(SONATRACH_ORANGE).lineWidth(1)
    .moveTo(A4_MARGIN, footerY).lineTo(doc.page.width - A4_MARGIN, footerY).stroke();

  // QR
  doc.image(qrBuffer, A4_MARGIN, footerY + 10, { width: 80, height: 80 });

  // Document metadata
  doc.fillColor(SONATRACH_NAVY).font('Helvetica-Bold').fontSize(9)
    .text('Document scellé — Vérification SHA-256', A4_MARGIN + 100, footerY + 12);
  doc.fillColor('#444').font('Helvetica').fontSize(8)
    .text(`Référence: ${documentRef}`, A4_MARGIN + 100, footerY + 28)
    .text(`Empreinte (SHA-256):`, A4_MARGIN + 100, footerY + 42)
    .font('Courier').fontSize(7).fillColor('#666')
    .text(documentHash, A4_MARGIN + 100, footerY + 54, { width: 380 });

  doc.font('Helvetica').fontSize(7).fillColor('#999')
    .text(
      'Ce document a été généré automatiquement par SonaERP v5.0. ' +
        'Toute modification invalide la signature cryptographique. ' +
        'Conformément à la Directive E-025/M R4, ce PV doit être archivé pendant 10 ans.',
      A4_MARGIN, footerY + 95,
      { width: doc.page.width - 2 * A4_MARGIN, align: 'center' },
    );
}

function sectionTitle(doc: PDFKit.PDFDocument, label: string) {
  doc.moveDown();
  doc.fillColor(SONATRACH_NAVY).font('Helvetica-Bold').fontSize(12).text(label);
  doc.strokeColor(SONATRACH_ORANGE).lineWidth(0.5)
    .moveTo(A4_MARGIN, doc.y + 2).lineTo(doc.page.width - A4_MARGIN, doc.y + 2).stroke();
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(10).fillColor('#222');
}

function field(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#666').text(label, { continued: false });
  doc.font('Helvetica').fontSize(11).fillColor('#111').text(value);
  doc.moveDown(0.4);
}

// ─── Template A: Gré à Gré ──────────────────────────────────────────────────

export interface GreAGreInput {
  contract: {
    id: string;
    referenceNumber: string;
    titleFr: string;
    totalAmount: string;
    currency: string;
    paymentTerms?: string | null;
    effectiveDate?: Date | null;
    expiryDate?: Date | null;
    durationMonths?: number | null;
  };
  project: {
    referenceNumber: string;
    titleFr: string;
    objectFr: string;
    departmentName: string;
  };
  supplier: {
    registrationNumber: string;
    companyNameFr: string;
    addressFr?: string | null;
    legalRepresentative?: string | null;
  };
  derogation: {
    article: string; // e.g. "Art. 49 §3"
    reason: string;
    technicalExclusivity?: string;
    oemReference?: string;
  };
}

export async function generateContractGreAGre(input: GreAGreInput): Promise<{
  buffer: Buffer;
  sha256Hash: string;
}> {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: A4_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      const hash = sha256(buffer);
      resolve({ buffer, sha256Hash: hash });
    });
    doc.on('error', reject);

    // Header
    await renderHeader(
      doc,
      `CONTRAT DE GRÉ À GRÉ — ${input.contract.referenceNumber}`,
      `Procédure dérogatoire — ${input.derogation.article}`,
    );

    // Préambule
    sectionTitle(doc, 'PRÉAMBULE');
    doc.text(
      `Entre les soussignés, la SONATRACH (le "Pouvoir Adjudicateur"), représentée par son ` +
        `Direction ${input.project.departmentName}, et la société ${input.supplier.companyNameFr} ` +
        `(le "Titulaire"), il a été convenu et arrêté ce qui suit, dans le cadre du projet ` +
        `${input.project.referenceNumber} — ${input.project.titleFr}.`,
      { align: 'justify' },
    );

    // Objet
    sectionTitle(doc, 'ARTICLE 1 — OBJET DU CONTRAT');
    doc.text(input.project.objectFr, { align: 'justify' });

    // Justification de la procédure
    sectionTitle(doc, `ARTICLE 2 — JUSTIFICATION DE LA PROCÉDURE DE GRÉ À GRÉ (${input.derogation.article})`);
    doc.text(input.derogation.reason, { align: 'justify' });
    if (input.derogation.technicalExclusivity) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text('Exclusivité technique: ', { continued: true });
      doc.font('Helvetica').text(input.derogation.technicalExclusivity);
    }
    if (input.derogation.oemReference) {
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text('Référence OEM: ', { continued: true });
      doc.font('Helvetica').text(input.derogation.oemReference);
    }

    // Identification du Titulaire
    sectionTitle(doc, 'ARTICLE 3 — IDENTIFICATION DU TITULAIRE');
    field(doc, 'Raison sociale', input.supplier.companyNameFr);
    field(doc, 'Numéro de Registre du Commerce', input.supplier.registrationNumber);
    if (input.supplier.legalRepresentative) {
      field(doc, 'Représentant légal', input.supplier.legalRepresentative);
    }
    if (input.supplier.addressFr) {
      field(doc, 'Adresse', input.supplier.addressFr);
    }

    // Conditions financières
    sectionTitle(doc, 'ARTICLE 4 — CONDITIONS FINANCIÈRES');
    field(doc, 'Montant total du marché', `${formatDZD(input.contract.totalAmount)} (${input.contract.currency})`);
    if (input.contract.paymentTerms) {
      field(doc, 'Conditions de paiement', input.contract.paymentTerms);
    }

    // Délai
    sectionTitle(doc, 'ARTICLE 5 — DÉLAI D\'EXÉCUTION');
    if (input.contract.durationMonths) {
      field(doc, 'Durée du marché', `${input.contract.durationMonths} mois`);
    }
    field(doc, 'Date d\'entrée en vigueur', formatDate(input.contract.effectiveDate));
    field(doc, 'Date d\'expiration', formatDate(input.contract.expiryDate));

    // Clôture
    sectionTitle(doc, 'CLAUSES FINALES');
    doc.text(
      'Le présent contrat est régi par la législation algérienne relative aux marchés publics ' +
        'et par la Directive interne Sonatrach E-025/M R4. Tout litige sera porté devant les ' +
        'juridictions algériennes compétentes.',
      { align: 'justify' },
    );

    // QR + footer (must be on the last page only)
    const verificationPayload = JSON.stringify({
      type: 'CONTRACT_GRE_A_GRE',
      ref: input.contract.referenceNumber,
      project: input.project.referenceNumber,
      supplier: input.supplier.registrationNumber,
      amount: input.contract.totalAmount,
    });
    const tentativeHash = sha256(verificationPayload);
    await renderQrFooter(doc, verificationPayload, input.contract.referenceNumber, tentativeHash);

    doc.end();
  });
}

// ─── Template B: Appel d'Offres ─────────────────────────────────────────────

export interface AppelOffresInput {
  contract: {
    id: string;
    referenceNumber: string;
    titleFr: string;
    totalAmount: string;
    currency: string;
    paymentTerms?: string | null;
    effectiveDate?: Date | null;
    expiryDate?: Date | null;
    durationMonths?: number | null;
  };
  project: {
    referenceNumber: string;
    titleFr: string;
    objectFr: string;
    departmentName: string;
    minimumBidCount: number;
  };
  supplier: {
    registrationNumber: string;
    companyNameFr: string;
  };
  award: {
    cccMeetingRef: string;
    decisionDate: Date;
    pvSha256Hash: string;
    competitorCount: number;
    technicalScore?: string;
    commercialScore?: string;
    compositeScore?: string;
    rank: number;
    scoringMatrix?: Array<{ criterion: string; weight: string; score: string }>;
  };
  publicOpening: {
    openedAt: Date;
    witnessCount: number;
    bidsOpenedCount: number;
  };
}

export async function generateContractAppelOffres(input: AppelOffresInput): Promise<{
  buffer: Buffer;
  sha256Hash: string;
}> {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: A4_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      const hash = sha256(buffer);
      resolve({ buffer, sha256Hash: hash });
    });
    doc.on('error', reject);

    await renderHeader(
      doc,
      `CONTRAT — ${input.contract.referenceNumber}`,
      `Procédure d'Appel d'Offres — Adjugé par CCC ${input.award.cccMeetingRef}`,
    );

    // Préambule
    sectionTitle(doc, 'PRÉAMBULE');
    doc.text(
      `Entre les soussignés, la SONATRACH (le "Pouvoir Adjudicateur"), représentée par sa ` +
        `Direction ${input.project.departmentName}, et la société ${input.supplier.companyNameFr} ` +
        `(le "Titulaire"), il a été convenu ce qui suit, suite à l'Appel d'Offres ` +
        `${input.project.referenceNumber} et à la décision de la Commission de Contrôle des ` +
        `Commandes (CCC) du ${formatDate(input.award.decisionDate)}.`,
      { align: 'justify' },
    );

    // Objet
    sectionTitle(doc, 'ARTICLE 1 — OBJET DU CONTRAT');
    doc.text(input.project.objectFr, { align: 'justify' });

    // Procédure d'attribution
    sectionTitle(doc, 'ARTICLE 2 — PROCÉDURE D\'ATTRIBUTION');
    field(doc, 'Type de procédure', 'Appel d\'Offres ouvert');
    field(doc, 'Nombre de soumissionnaires', String(input.award.competitorCount));
    field(doc, 'Quorum minimum requis', String(input.project.minimumBidCount));
    field(doc, 'Décision CCC (référence PV)', input.award.cccMeetingRef);
    field(doc, 'Empreinte SHA-256 du PV', input.award.pvSha256Hash);
    field(doc, 'Date de décision', formatDate(input.award.decisionDate));

    // Ouverture publique
    sectionTitle(doc, 'ARTICLE 3 — OUVERTURE PUBLIQUE DES PLIS');
    field(doc, 'Date d\'ouverture', formatDate(input.publicOpening.openedAt));
    field(doc, 'Nombre de témoins', String(input.publicOpening.witnessCount));
    field(doc, 'Plis ouverts', String(input.publicOpening.bidsOpenedCount));

    // Matrice de notation
    if (input.award.scoringMatrix && input.award.scoringMatrix.length > 0) {
      sectionTitle(doc, 'ARTICLE 4 — MATRICE DE NOTATION (60% Technique / 40% Commercial)');

      const tableTop = doc.y;
      const colX = [A4_MARGIN, A4_MARGIN + 250, A4_MARGIN + 370, A4_MARGIN + 450];

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#fff');
      doc.rect(A4_MARGIN, tableTop, doc.page.width - 2 * A4_MARGIN, 18).fill(SONATRACH_NAVY);
      doc.fillColor('#fff');
      doc.text('Critère', colX[0] + 5, tableTop + 5);
      doc.text('Poids', colX[1] + 5, tableTop + 5);
      doc.text('Score', colX[2] + 5, tableTop + 5);
      doc.text('Pondéré', colX[3] + 5, tableTop + 5);

      let y = tableTop + 18;
      doc.font('Helvetica').fontSize(9).fillColor('#222');
      for (const row of input.award.scoringMatrix) {
        doc.text(row.criterion, colX[0] + 5, y + 4, { width: 240 });
        doc.text(row.weight, colX[1] + 5, y + 4);
        doc.text(row.score, colX[2] + 5, y + 4);
        const weighted = (parseFloat(row.weight) * parseFloat(row.score) / 100).toFixed(2);
        doc.text(weighted, colX[3] + 5, y + 4);
        y += 16;
      }
      doc.y = y + 8;

      if (input.award.technicalScore || input.award.commercialScore || input.award.compositeScore) {
        doc.moveDown(0.5);
        if (input.award.technicalScore) field(doc, 'Score technique global', input.award.technicalScore);
        if (input.award.commercialScore) field(doc, 'Score commercial global', input.award.commercialScore);
        if (input.award.compositeScore) field(doc, 'Score composite (60T+40C)', input.award.compositeScore);
        field(doc, 'Rang final', `${input.award.rank} / ${input.award.competitorCount}`);
      }
    }

    // Conditions
    sectionTitle(doc, 'ARTICLE 5 — CONDITIONS FINANCIÈRES');
    field(doc, 'Montant total du marché', `${formatDZD(input.contract.totalAmount)} (${input.contract.currency})`);
    if (input.contract.paymentTerms) {
      field(doc, 'Conditions de paiement', input.contract.paymentTerms);
    }
    if (input.contract.durationMonths) {
      field(doc, 'Durée d\'exécution', `${input.contract.durationMonths} mois`);
    }
    field(doc, 'Entrée en vigueur', formatDate(input.contract.effectiveDate));
    field(doc, 'Date d\'expiration', formatDate(input.contract.expiryDate));

    // Clauses finales
    sectionTitle(doc, 'CLAUSES FINALES');
    doc.text(
      'Le présent contrat, fruit d\'une procédure compétitive d\'Appel d\'Offres ouverte et ' +
        'validée par la Commission de Contrôle des Commandes, est régi par la législation ' +
        'algérienne et la Directive interne Sonatrach E-025/M R4.',
      { align: 'justify' },
    );

    const verificationPayload = JSON.stringify({
      type: 'CONTRACT_APPEL_OFFRES',
      ref: input.contract.referenceNumber,
      project: input.project.referenceNumber,
      supplier: input.supplier.registrationNumber,
      amount: input.contract.totalAmount,
      ccc: input.award.cccMeetingRef,
    });
    const tentativeHash = sha256(verificationPayload);
    await renderQrFooter(doc, verificationPayload, input.contract.referenceNumber, tentativeHash);

    doc.end();
  });
}

// ─── Audit Trail Report ─────────────────────────────────────────────────────

export interface AuditTrailInput {
  reportTitle: string;
  resourceType: string;
  resourceRef: string;
  resourceTitle: string;
  generatedBy: string;
  entries: Array<{
    sequence: number;
    createdAt: Date;
    action: string;
    actorEmail: string;
    description: string;
    justification?: string | null;
    chainHash: string;
  }>;
  chainHead: { sequence: number; chainHash: string } | null;
}

export async function generateAuditTrailReport(input: AuditTrailInput): Promise<{
  buffer: Buffer;
  sha256Hash: string;
}> {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: A4_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      const hash = sha256(buffer);
      resolve({ buffer, sha256Hash: hash });
    });
    doc.on('error', reject);

    await renderHeader(
      doc,
      input.reportTitle,
      `Piste d'audit immuable — Chaîne SHA-256 vérifiable`,
    );

    sectionTitle(doc, 'IDENTIFIANT DU DOSSIER');
    field(doc, 'Type de ressource', input.resourceType);
    field(doc, 'Référence', input.resourceRef);
    field(doc, 'Intitulé', input.resourceTitle);
    field(doc, 'Rapport généré par', input.generatedBy);
    field(doc, 'Date de génération', new Date().toLocaleString('fr-FR'));

    sectionTitle(doc, `JOURNAL CHRONOLOGIQUE (${input.entries.length} événements)`);

    for (const e of input.entries) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(SONATRACH_NAVY)
        .text(`#${e.sequence} — ${e.action}`, { continued: true });
      doc.font('Helvetica').fillColor('#666')
        .text(`   ${e.createdAt.toLocaleString('fr-FR')}`);
      doc.font('Helvetica').fontSize(9).fillColor('#222')
        .text(`Acteur: ${e.actorEmail}`)
        .text(`Action: ${e.description}`);
      if (e.justification) {
        doc.fillColor('#666').text(`Justification: ${e.justification}`, { width: doc.page.width - 2 * A4_MARGIN });
      }
      doc.fillColor('#999').font('Courier').fontSize(7)
        .text(`hash: ${e.chainHash}`);
      doc.moveDown(0.4);
      doc.strokeColor('#eee').lineWidth(0.3)
        .moveTo(A4_MARGIN, doc.y).lineTo(doc.page.width - A4_MARGIN, doc.y).stroke();
      doc.moveDown(0.4);

      // Page break if low on space
      if (doc.y > doc.page.height - 200) {
        doc.addPage();
      }
    }

    if (input.chainHead) {
      sectionTitle(doc, 'TÊTE DE CHAÎNE D\'AUDIT (chain head)');
      doc.font('Helvetica').fontSize(10).fillColor('#222')
        .text(`Séquence: ${input.chainHead.sequence}`);
      doc.font('Courier').fontSize(8).fillColor('#444')
        .text(input.chainHead.chainHash, { width: doc.page.width - 2 * A4_MARGIN });
    }

    const verificationPayload = JSON.stringify({
      type: 'AUDIT_TRAIL',
      resource: `${input.resourceType}:${input.resourceRef}`,
      entries: input.entries.length,
      chainHead: input.chainHead?.chainHash ?? null,
    });
    const tentativeHash = sha256(verificationPayload);
    await renderQrFooter(doc, verificationPayload, input.resourceRef, tentativeHash);

    doc.end();
  });
}
