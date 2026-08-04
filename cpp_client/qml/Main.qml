import QtQuick
import QtQuick.Controls
import QtQuick.Window

Window {
    width: 1200
    height: 800
    visible: true
    title: qsTr("OpenBeam (C++ Edition)")
    color: "#0d0d14"

    Rectangle {
        anchors.centerIn: parent
        width: 400
        height: 200
        color: "#1e1e2e"
        radius: 12
        border.color: "#7c6af7"
        border.width: 2

        Column {
            anchors.centerIn: parent
            spacing: 20

            Text {
                text: "Hello from C++ and Qt!"
                color: "white"
                font.pixelSize: 24
                font.bold: true
                anchors.horizontalCenter: parent.horizontalCenter
            }

            Button {
                text: "Click to Test UI"
                anchors.horizontalCenter: parent.horizontalCenter
                onClicked: {
                    console.log("Button clicked!")
                }
            }
        }
    }
}
