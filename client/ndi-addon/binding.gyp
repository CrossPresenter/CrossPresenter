{
  "targets": [
    {
      "target_name": "ndi_sender",
      "sources": [ "src/ndi_sender.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<(module_root_dir)/include",
        "C:/Program Files/NDI/NDI 6 SDK/Include"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ['OS=="win"', {
          "libraries": [
            "C:/Program Files/NDI/NDI 6 SDK/Lib/x64/Processing.NDI.Lib.x64.lib"
          ],
          "copies": [
            {
              "destination": "<(module_root_dir)/build/Release/",
              "files": [ "C:/Program Files/NDI/NDI 6 SDK/Bin/x64/Processing.NDI.Lib.x64.dll" ]
            }
          ]
        }]
      ]
    }
  ]
}
