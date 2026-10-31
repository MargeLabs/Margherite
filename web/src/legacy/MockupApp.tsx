'use client';

import { useMemo } from 'react';
import { DCLogic, DcHost, type LogicClass, type Scope } from './dc-engine';
import { template } from './template.generated';
import { createLogicClass } from './logic.generated';
import defaults from './props.generated.json';

/** La maquette V5 telle quelle (données d'exemple intégrées) : sert de référence de fidélité. */
export function MockupApp({ overrides }: { overrides: Record<string, string> }) {
  const Logic = useMemo(() => (createLogicClass as unknown as (base: typeof DCLogic) => LogicClass)(DCLogic), []);
  const logicProps = useMemo<Scope>(() => ({ ...defaults, ...overrides }), [overrides]);
  return <DcHost template={template} Logic={Logic} logicProps={logicProps} />;
}
