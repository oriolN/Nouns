import { JsonRpcSigner } from "@ethersproject/providers";
import { Trans } from '@lingui/macro';
import { useEthers } from "@usedapp/core";
import { useCallback, useEffect, useState } from "react";
import { Button, Container } from "react-bootstrap";
import ReactMarkdown from "react-markdown";
import { RouteComponentProps } from "react-router-dom";
import remarkBreaks from "remark-breaks";
import config, { CHAIN_ID } from "../../config";
import { useAppDispatch } from "../../hooks";
import Section from "../../layout/Section";
import { AlertModal, setAlertModal } from "../../state/slices/application";
import { useProposeBySigs, useUpdateProposalBySigs } from "../../wrappers/nounsDao";
import { addSignature, DraftProposal, getDraftProposals, ProposalContent } from "../CreateDraftProposal/DraftProposalsStorage";

const domain = {
  name: 'Nouns DAO',
  chainId: CHAIN_ID,
  verifyingContract: config.addresses.nounsDAOProxy
};

const types = {
  Proposal: [
    { name: 'proposer', type: 'address' },
    { name: 'targets', type: 'address[]' },
    { name: 'values', type: 'uint256[]' },
    { name: 'signatures', type: 'string[]' },
    { name: 'calldatas', type: 'bytes[]' },
    { name: 'description', type: 'string' },
    { name: 'expiry', type: 'uint40' }
  ]
};

const DraftProposalPage = ({
  match: {
    params: { id },
  },
}: RouteComponentProps<{ id: string }>) => {
  const proposalId = Number.parseInt(id);
  const { library, chainId } = useEthers();
  const signer = library?.getSigner();
  const [draftProposal, setDraftProposal] = useState<DraftProposal | undefined>(undefined);
  const [expiry, setExpiry] = useState(Math.round(Date.now() / 1000));
  const [proposalIdToUpdate, setProposalIdToUpdate] = useState('');

  useEffect(() => {
    const draftProposals = getDraftProposals();
    setDraftProposal(draftProposals[proposalId]);
  }, []);


  async function sign() {
    if (!draftProposal) return;

    const value = {
      ...draftProposal.proposalContent,
      'expiry': expiry
    };

    const signature = await signer!._signTypedData(domain, types, value);
    const updatedDraftProposal = addSignature(
      {
        signer: await signer!.getAddress(), 
        signature: signature!, 
        expiry: expiry}, 
      proposalId);
    setDraftProposal(updatedDraftProposal);
  }

  const [isProposePending, setProposePending] = useState(false);
  
  const dispatch = useAppDispatch();
  const setModal = useCallback((modal: AlertModal) => dispatch(setAlertModal(modal)), [dispatch]);
  const { proposeBySigs, proposeBySigsState } = useProposeBySigs();
  const { updateProposalBySigs, updateProposalBySigState } = useUpdateProposalBySigs();

  useEffect(() => {
    switch (proposeBySigsState.status) {
      case 'None':
        setProposePending(false);
        break;
      case 'Mining':
        setProposePending(true);
        break;
      case 'Success':
        setModal({
          title: <Trans>Success</Trans>,
          message: <Trans>Proposal Created!</Trans>,
          show: true,
        });
        setProposePending(false);
        break;
      case 'Fail':
        setModal({
          title: <Trans>Transaction Failed</Trans>,
          message: proposeBySigsState?.errorMessage || <Trans>Please try again.</Trans>,
          show: true,
        });
        setProposePending(false);
        break;
      case 'Exception':
        setModal({
          title: <Trans>Error</Trans>,
          message: proposeBySigsState?.errorMessage || <Trans>Please try again.</Trans>,
          show: true,
        });
        setProposePending(false);
        break;
    }
  }, [proposeBySigsState, setModal]);

  useEffect(() => {
    switch (updateProposalBySigState.status) {
      case 'None':
        setProposePending(false);
        break;
      case 'Mining':
        setProposePending(true);
        break;
      case 'Success':
        setModal({
          title: <Trans>Success</Trans>,
          message: <Trans>Proposal Updated!</Trans>,
          show: true,
        });
        setProposePending(false);
        break;
      case 'Fail':
        setModal({
          title: <Trans>Transaction Failed</Trans>,
          message: updateProposalBySigState?.errorMessage || <Trans>Please try again.</Trans>,
          show: true,
        });
        setProposePending(false);
        break;
      case 'Exception':
        setModal({
          title: <Trans>Error</Trans>,
          message: updateProposalBySigState?.errorMessage || <Trans>Please try again.</Trans>,
          show: true,
        });
        setProposePending(false);
        break;
    }
  }, [updateProposalBySigState, setModal]);

  async function proposeBySigsClicked() {
    await proposeBySigs(
      draftProposal?.signatures.map(s => [s.signature, s.signer, s.expiry]),
      draftProposal?.proposalContent.targets,
      draftProposal?.proposalContent.values,
      draftProposal?.proposalContent.signatures,
      draftProposal?.proposalContent.calldatas,
      draftProposal?.proposalContent.description,
    );
  }

  async function updateProposalBySigsClicked() {
    const proposalId = Number.parseInt(proposalIdToUpdate);

    await updateProposalBySigs(
      proposalId,
      draftProposal?.signatures.map(s => [s.signature, s.signer, s.expiry]),
      draftProposal?.proposalContent.targets,
      draftProposal?.proposalContent.values,
      draftProposal?.proposalContent.signatures,
      draftProposal?.proposalContent.calldatas,
      draftProposal?.proposalContent.description,
    )
  }

  return (
    <Section fullWidth={false}>
      <h1>Draft Proposal {id}</h1>
      {draftProposal && (
        <ReactMarkdown
          children={draftProposal.proposalContent.description}
          remarkPlugins={[remarkBreaks]}
          />
      )}
      <pre>
        {JSON.stringify(draftProposal, null, 4)}
      </pre>
      
      <label>Expiry: <input type="text" value={expiry} onChange={e => setExpiry(Number.parseInt(e.target.value))} /></label>
      
      <Button onClick={() => sign()} style={{marginBottom: 10}}>Sign proposal</Button>
      <Button onClick={() => proposeBySigsClicked()} style={{marginBottom: 10}}>proposeBySigs</Button>

      <Container>
        <label>
          Update proposal id (leave empty if creating a new proposal):
          <input type="text" value={proposalIdToUpdate} onChange={e => setProposalIdToUpdate(e.target.value)} />
        </label>
        <Button onClick={() => updateProposalBySigsClicked()} style={{display: 'inline'}}>updateProposalBySig</Button>
      </Container>
    </Section>
  )
}

export default DraftProposalPage;