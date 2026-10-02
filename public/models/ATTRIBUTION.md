# FleetIO demonstration assets

Runtime copies of the user-supplied downloads. Originals remain untouched in Assets.

- Warehouse: Warehouse FBX Model Free. Author: Nicholas-3D (https://sketchfab.com/Nicholas01). License: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Source: https://sketchfab.com/3d-models/warehouse-fbx-model-free-daa7fd3ff88945298d00045ca40a4c03. Native footprint approximately 16 × 46.15 metres. GLTFLoader transforms are retained; the runtime presentation removes roof and high wall triangles for a cutaway, normalizes the footprint to 46 metres long, and adjusts concrete roughness.
- AGV: 57561acfdc58441081e73afa8dd0b7dd.obj, Latent AGV autonomous warehouse robot package. Native footprint 0.807 × 1.092 metres. The absent material.mtl is replaced with authored orange chassis and dark mechanical materials based on supplied renders. A derivative 4,785-triangle overview LOD preserves its silhouette and footprint; the inspector and followed robot use the original full geometry.
- Shelving: shelf00.dae, warehouse-shelving-unit package. Declared inch units and Z up are converted once by ColladaLoader. The three supplied diffuse textures are resolved by filename. Shelving is uniformly scaled to fit declared rack footprints.

No author or license information was found in the supplied AGV and shelving packages. Their attribution and redistribution license details require verification against the original download pages; no license is inferred for them.
