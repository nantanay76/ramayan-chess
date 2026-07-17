import { Scene } from './Scene';
import { LoadingVeil } from '../ui/LoadingVeil';

/** The single lazy-loaded entry for everything that pulls in three.js — the
 *  Scene and the drei-powered LoadingVeil — so the menu never parses the 3D
 *  stack. Default export for React.lazy. */
export default function GameCanvas() {
  return (
    <>
      <Scene />
      <LoadingVeil />
    </>
  );
}
