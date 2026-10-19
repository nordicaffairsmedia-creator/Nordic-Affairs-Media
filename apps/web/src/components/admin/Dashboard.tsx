import { Welcome } from './Welcome'

/*
 * Replaces Payload's default dashboard (which repeats every menu item as a tile) with our
 * own: the left menu is the only place to navigate, the dashboard only shows the facts and
 * the "start building" shortcuts.
 */
export function Dashboard(props: { user?: unknown; initPageResult?: { req?: { user?: unknown } } }) {
  const user = props.user ?? props.initPageResult?.req?.user
  return (
    <div className="gutter--left gutter--right nam-dash-view">
      <Welcome user={user} />
    </div>
  )
}
