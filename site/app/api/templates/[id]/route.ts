import { deliverTemplate } from "../../../../lib/templates-pro-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const handle = async (req: Request, { params }: Ctx) => {
  const { POLAR_ORG_ID, TEMPLATES_REPO, TEMPLATES_REPO_TOKEN } = process.env;
  return deliverTemplate(req, (await params).id, { POLAR_ORG_ID, TEMPLATES_REPO, TEMPLATES_REPO_TOKEN });
};

export const GET = handle;
export const POST = handle;
