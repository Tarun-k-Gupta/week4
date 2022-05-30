import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { Contract, providers, utils } from "ethers"
import Head from "next/head"
import React from "react"
import styles from "../styles/Home.module.css"
import { useForm } from "react-hook-form";
import { object, string, number } from 'yup';
import abi from "./utils/Greeters.json";
import { yupResolver } from '@hookform/resolvers/yup';

const formSchema = object({
    Name: string().required(),
    Age: number().required().positive().integer(),
    Address: string().required(),
});


export default function Home() {
    const contractABI = abi.abi;
    const { register, handleSubmit } = useForm({
        resolver: yupResolver(formSchema)
    });
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const [Greet, setGreet] = React.useState("")

    async function greet() {

        const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", contractABI)
        const Provider = new providers.JsonRpcProvider("http://localhost:8545")

        const contractOwner = contract.connect(Provider.getSigner())
        contractOwner.on("NewGreeting", (greeting) => {
            console.log(utils.parseBytes32String(greeting));
            setGreet(utils.parseBytes32String(greeting));
        })

        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"
        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }
    const onSubmit = (data: any) => console.log(data);
    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>
                <h2>
                    {Greet}
                </h2>
            </main>
            <form onSubmit={handleSubmit(onSubmit)}>
                <h2>Form</h2>

                <input {...register('Name')} placeholder="Name" className={styles.description} />
                <br />

                <input {...register('Address')} placeholder="Address" className={styles.description} />
                <br />

                <input {...register('Age')} placeholder="Age" className={styles.description} />
                <br />

                <input type="submit" className={styles.button} />
            </form>

        </div>
    )
}
