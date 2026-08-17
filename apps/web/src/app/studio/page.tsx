import { redirect } from 'next/navigation';

/**
 * `/studio` folded into `/create`, which is now responsive and serves the desktop
 * workspace above the `lg` breakpoint. The route stays so existing bookmarks and
 * links keep working.
 *
 * Deliberately a temporary (307) redirect rather than a permanent one: browsers
 * cache a 308 indefinitely, so if the canonical URL is ever revisited, anyone who
 * had loaded this once could not reach `/studio` again without clearing state.
 * Promote it to `permanentRedirect` once the single-route architecture has
 * settled — it is a one-word change.
 */
export default function StudioPage() {
  redirect('/create');
}
