import React from "react";

import {ASUIPanel, ASUIFormMessage, ASUIClickable, ASUIModal} from "../../components";

export default class ASComposerRegistrationSuccessModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
        const composer = props.composer;
        this.cb = {
            closeModal: () => composer.toggleModal(null),
        }
        this.ref = {
            // email: React.createRef(),
        }

    }

    getComposer() { return this.props.composer; }

    render() {
        return (
            <ASUIModal
                onClose={this.cb.closeModal}
            >
                <ASUIPanel
                    large
                    horizontal
                    header="Registration Successful">
                    <ASUIFormMessage children="Registration Successful"/>
                    <ASUIClickable
                        button center
                        size="large"
                        onAction={this.cb.toggleModal}
                    >Close</ASUIClickable>
                </ASUIPanel>
            </ASUIModal>
        );
    }

}


