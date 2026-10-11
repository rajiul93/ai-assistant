/** An affix without its dashes and case, for spotting the same one written differently ("un" / "Un-"). */
export const bareAffix = (affix: string) => affix.replace(/^[-–]+|[-–]+$/g, "").toLowerCase();
