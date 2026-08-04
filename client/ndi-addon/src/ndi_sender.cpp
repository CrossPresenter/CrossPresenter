#include <napi.h>
#include <Processing.NDI.Lib.h>
#include <iostream>

class NDISender : public Napi::ObjectWrap<NDISender> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    NDISender(const Napi::CallbackInfo& info);
    ~NDISender();

private:
    Napi::Value SendFrame(const Napi::CallbackInfo& info);
    Napi::Value Destroy(const Napi::CallbackInfo& info);

    NDIlib_send_instance_t pNDI_send;
    NDIlib_video_frame_v2_t NDI_video_frame;
    bool is_initialized;
    std::string senderName;
};

Napi::Object NDISender::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "NDISender", {
        InstanceMethod("sendFrame", &NDISender::SendFrame),
        InstanceMethod("destroy", &NDISender::Destroy)
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("NDISender", func);
    return exports;
}

NDISender::NDISender(const Napi::CallbackInfo& info) : Napi::ObjectWrap<NDISender>(info) {
    Napi::Env env = info.Env();
    
    this->senderName = "OpenBeam NDI";
    if (info.Length() > 0 && info[0].IsString()) {
        this->senderName = info[0].As<Napi::String>().Utf8Value();
    }

    if (!NDIlib_initialize()) {
        Napi::Error::New(env, "Cannot initialize NDI").ThrowAsJavaScriptException();
        return;
    }

    NDIlib_send_create_t NDI_send_create_desc;
    NDI_send_create_desc.p_ndi_name = this->senderName.c_str();
    NDI_send_create_desc.p_groups = NULL;
    NDI_send_create_desc.clock_video = true;
    NDI_send_create_desc.clock_audio = false;

    pNDI_send = NDIlib_send_create(&NDI_send_create_desc);
    if (!pNDI_send) {
        Napi::Error::New(env, "Cannot create NDI sender").ThrowAsJavaScriptException();
        return;
    }

    // Default 1080p frame configuration
    NDI_video_frame.xres = 1920;
    NDI_video_frame.yres = 1080;
    // BGRX matches Electron NativeImage.toBitmap() (BGRA byte order) so no per-pixel conversion is needed
    NDI_video_frame.FourCC = NDIlib_FourCC_type_BGRX;
    NDI_video_frame.p_data = nullptr;
    NDI_video_frame.line_stride_in_bytes = 1920 * 4;
    NDI_video_frame.frame_rate_N = 60000;
    NDI_video_frame.frame_rate_D = 1000;

    is_initialized = true;
}

NDISender::~NDISender() {
    if (is_initialized) {
        NDIlib_send_destroy(pNDI_send);
        NDIlib_destroy();
        is_initialized = false;
    }
}

Napi::Value NDISender::Destroy(const Napi::CallbackInfo& info) {
    if (is_initialized) {
        NDIlib_send_destroy(pNDI_send);
        NDIlib_destroy();
        is_initialized = false;
    }
    return info.Env().Undefined();
}

Napi::Value NDISender::SendFrame(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!is_initialized) {
        Napi::Error::New(env, "NDI Sender is destroyed").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    if (info.Length() < 1 || (!info[0].IsArrayBuffer() && !info[0].IsTypedArray())) {
        Napi::TypeError::New(env, "Expected an ArrayBuffer or TypedArray").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uint8_t* bufferData = nullptr;
    size_t bufferLength = 0;

    if (info[0].IsArrayBuffer()) {
        Napi::ArrayBuffer buffer = info[0].As<Napi::ArrayBuffer>();
        bufferData = reinterpret_cast<uint8_t*>(buffer.Data());
        bufferLength = buffer.ByteLength();
    } else {
        Napi::Uint8Array typedArray = info[0].As<Napi::Uint8Array>();
        bufferData = typedArray.Data();
        bufferLength = typedArray.ByteLength();
    }
    
    if (info.Length() >= 3) {
        NDI_video_frame.xres = info[1].As<Napi::Number>().Int32Value();
        NDI_video_frame.yres = info[2].As<Napi::Number>().Int32Value();
        NDI_video_frame.line_stride_in_bytes = NDI_video_frame.xres * 4;
    }

    if (bufferLength < (size_t)(NDI_video_frame.line_stride_in_bytes * NDI_video_frame.yres)) {
        Napi::Error::New(env, "Buffer size does not match resolution").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    NDI_video_frame.p_data = bufferData;

    // Send the frame (async execution inside the NDI SDK)
    NDIlib_send_send_video_v2(pNDI_send, &NDI_video_frame);

    return env.Undefined();
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return NDISender::Init(env, exports);
}

NODE_API_MODULE(ndi_addon, InitAll)
