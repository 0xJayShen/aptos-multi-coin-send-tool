script {
    use aptos_framework::coin;

    fun main<CoinType1, CoinType2>(sender: &signer, reciever: address, amount1: u64, amount2: u64) {
        let coins1 = coin::withdraw<CoinType1>(sender, amount1);
        let coins2 = coin::withdraw<CoinType2>(sender, amount2);

        coin::deposit(reciever, coins1);
        coin::deposit(reciever, coins2);
    }
}
