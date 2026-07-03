import PageHeader from "@/components/PageHeader";

const HERO_IMAGE =
  "https://customer-assets.emergentagent.com/job_tgx-api-gateway/artifacts/v63grioq_file_000000003580720b84b6c5daae428f49.png";

export default function BotHub() {
  return (
    <div className="pb-24" data-testid="bothub-page">
      <PageHeader title="Welcome to TGX BOT" subtitle="AI Powered Exchange" showBack={false} />

      {/* Hero image */}
      <div className="px-4 mt-2">
        <div
          className="relative w-full overflow-hidden rounded-2xl border border-[#39FF14]/25"
          style={{
            boxShadow:
              "0 0 30px rgba(57,255,20,0.15), inset 0 0 20px rgba(0,0,0,0.4)",
          }}
          data-testid="bothub-hero"
        >
          <img
            src={HERO_IMAGE}
            alt="TGX BOT — AI Powered Exchange"
            className="w-full h-auto block"
            loading="eager"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
