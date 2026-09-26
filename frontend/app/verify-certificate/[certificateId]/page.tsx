import { GraduationCap, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_URL } from "@/lib/api-client";

interface VerifiedCertificate {
  certificateNumber: string;
  studentName: string;
  courseName: string;
  batchName: string;
  issueDate: string;
  status: "ISSUED" | "REVOKED";
}

async function fetchCertificate(certificateId: string): Promise<VerifiedCertificate | null> {
  try {
    const res = await fetch(`${API_URL}/certificates/verify/${encodeURIComponent(certificateId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: VerifiedCertificate };
    return body.data;
  } catch {
    return null;
  }
}

function CertificateDetails({ certificate }: { certificate: VerifiedCertificate }) {
  return (
    <dl className="space-y-2 rounded-md border border-border p-3">
      <Row label="Certificate #" value={certificate.certificateNumber} mono />
      <Row label="Student" value={certificate.studentName} />
      <Row label="Course" value={certificate.courseName} />
      <Row label="Batch" value={certificate.batchName} />
      <Row label="Issued on" value={new Date(certificate.issueDate).toLocaleDateString()} />
    </dl>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-xs text-foreground" : "font-medium text-foreground"}>{value}</dd>
    </div>
  );
}

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ certificateId: string }>;
}) {
  const { certificateId } = await params;
  const certificate = await fetchCertificate(certificateId);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/40 p-6">
      <Link href="/" className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </div>
        <span className="text-sm font-semibold text-foreground">SSR Portal</span>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Certificate Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!certificate ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3 text-muted-foreground">
              <ShieldAlert className="h-4 w-4 shrink-0 text-accent" />
              <span>
                No certificate found for ID{" "}
                <span className="font-mono text-foreground">{certificateId}</span>. Check the ID and try
                again.
              </span>
            </div>
          ) : certificate.status === "REVOKED" ? (
            <>
              <div className="flex items-center gap-2 rounded-md border border-status-critical/30 bg-status-critical/10 p-3 text-status-critical">
                <ShieldX className="h-4 w-4 shrink-0" />
                <span>This certificate has been revoked and is no longer valid.</span>
              </div>
              <CertificateDetails certificate={certificate} />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-md border border-status-good/30 bg-status-good/10 p-3 text-status-good">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>This is a valid certificate issued by SSR Institute.</span>
              </div>
              <CertificateDetails certificate={certificate} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
