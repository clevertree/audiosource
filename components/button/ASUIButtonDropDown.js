import ASUIMenuDropDown from "../menu/ASUIMenuDropDown";
import "./assets/ASUIButton.css"

export default class ASUIButtonDropDown extends ASUIMenuDropDown {
    // Default Properties
    static defaultProps = {
        arrow:          true,
        vertical:       true,
    };
    getClassName() { return 'asui-button'; }
}