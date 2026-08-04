#include <napi.h>

// Forward declaration of Init function from ndi_sender.cpp
Napi::Object InitAll(Napi::Env env, Napi::Object exports);

NODE_API_MODULE(ndi_addon, InitAll)
