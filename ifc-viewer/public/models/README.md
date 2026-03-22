# IFC Models Folder

Place your IFC files in this folder to automatically load them in the viewer.

## Supported Formats
- `.ifc` - Industry Foundation Classes files

## How to Use

### Method 1: Place IFC files directly in this folder
1. Copy your `.ifc` files to this `public/models/` directory
2. Refresh the browser - the viewer will automatically attempt to load them
3. Check the browser console for loading status

### Method 2: Use the Upload Button
1. Click the "Load IFC Files" button in the viewer's control panel
2. Select one or more `.ifc` files from your computer
3. The models will be loaded and displayed in the 3D viewer

## Example IFC Files
You can find sample IFC files at:
- [IFC Examples Repository](https://github.com/buildingSMART/Sample-Test-Files/tree/master/IFC)
- [That Open Company Resources](https://thatopen.github.io/engine_components/resources/)

## Notes
- Large IFC files may take some time to load
- The viewer will show a fallback fragment model if no IFC files are found
- Use the "Clear All Models" button to remove loaded models and start fresh