cmake_minimum_required(VERSION 3.16)

project(OpenBeam VERSION 0.1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find Qt6 dependencies
find_package(Qt6 REQUIRED COMPONENTS Core Gui Qml Quick WebEngineQuick)

qt_standard_project_setup()

qt_add_executable(OpenBeam
    src/main.cpp
)

# Add QML files to the executable
qt_add_qml_module(OpenBeam
    URI OpenBeam
    VERSION 1.0
    QML_FILES
        qml/Main.qml
)

target_link_libraries(OpenBeam
    PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Qml
    Qt6::Quick
    Qt6::WebEngineQuick
)
