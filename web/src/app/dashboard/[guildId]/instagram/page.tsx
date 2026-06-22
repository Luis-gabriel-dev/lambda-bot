import { requireGuildAdmin } from "@/lib/guards";
import { getGuildOptions } from "@/lib/discord";
import { prisma } from "@/lib/db";
import { InstaAddForm } from "@/components/insta-add-form";
import { removeInstaChannel, saveInstaDisclaimer } from "@/actions/instagram";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Instagram" };

export default async function InstagramPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  await requireGuildAdmin(guildId);

  const [rows, options] = await Promise.all([
    prisma.instagramChannel.findMany({ where: { guildId } }),
    getGuildOptions(guildId),
  ]);
  const channelName = (id: string) => options.channels.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Instagram</h1>
        <p className="text-muted-foreground text-sm">Photo/video feed channels — each upload becomes a likeable post.</p>
      </div>

      <InstaAddForm guildId={guildId} channels={options.channels} />

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No feed channels yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const colorHex = r.disclaimerColor != null ? `#${r.disclaimerColor.toString(16).padStart(6, "0")}` : "";
            return (
              <li key={r.channelId} className="space-y-3 rounded-lg border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium"># {channelName(r.channelId)}</span>
                  <form action={removeInstaChannel}>
                    <input type="hidden" name="guildId" value={guildId} />
                    <input type="hidden" name="channelId" value={r.channelId} />
                    <Button type="submit" variant="ghost" size="sm">
                      Remove
                    </Button>
                  </form>
                </div>
                <form action={saveInstaDisclaimer} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input type="hidden" name="guildId" value={guildId} />
                  <input type="hidden" name="channelId" value={r.channelId} />
                  <div className="flex-1 space-y-1">
                    <label className="text-muted-foreground text-xs">Disclaimer image URL</label>
                    <Input name="image" defaultValue={r.disclaimerImageUrl ?? ""} placeholder="https://…" />
                  </div>
                  <div className="space-y-1 sm:w-32">
                    <label className="text-muted-foreground text-xs">Color</label>
                    <Input name="color" defaultValue={colorHex} placeholder="#e1306c" />
                  </div>
                  <Button type="submit" variant="outline" size="sm">
                    Save
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
