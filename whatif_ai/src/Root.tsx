import React from "react";
import { Composition } from "remotion";
import { WhatIfShort, WHATIF_FRAMES } from "./whatif/Short";
export const Root: React.FC = () => (<>
  <Composition id="WhatIfAI2027" component={WhatIfShort} durationInFrames={WHATIF_FRAMES} fps={30} width={1080} height={1920} />
</>);
