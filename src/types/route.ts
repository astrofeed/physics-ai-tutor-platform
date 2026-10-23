export interface RouteContext<Params = { id: string }> {
  params: Promise<Params>;
}
