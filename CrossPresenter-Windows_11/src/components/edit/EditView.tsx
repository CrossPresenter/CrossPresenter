/**
 * Edit view: filmstrip on the left, the interactive canvas in the center,
 * the property inspector on the right. Composition only — every field and
 * gesture lives in the three child components.
 */

import { EditCanvas } from "./EditCanvas";
import { LayerInspector } from "./LayerInspector";
import { SlideFilmstrip } from "./SlideFilmstrip";

export function EditView() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <SlideFilmstrip />
      <EditCanvas />
      <LayerInspector />
    </div>
  );
}
