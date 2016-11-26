var forge = require('node-forge');
var rsa = forge.pki.rsa;
var BigInteger = forge.jsbn.BigInteger;

var datas = 'b0f8d644ea2608121321d84142347e47ae778b14571f7b1800ae3b77bfeef3bb'
var user = {alg: 'RSA-OAEP-256', e: 'AQAB', ext: true, key_ops: ['encrypt', 'wrapKey'], kty: 'RSA', n: '0PjVDOimPsWjhkakQLVQGRjVbPAabvtPKLNppXgG2gtRGBBXOzZDp2VbSScbHKlzlZuDBtqrgSNZNdHeitRLv1VmyRUtSNyq6K3cYR5r-MYweSLNT-R2MbFkpuQ8dWBBYIlscKk4uz8-arf3Tg6DHjpHZDJygSutOgS0Teiwv_Et9dzye7PWnAznkMIZtfNdvuGPPhb1FdS3DSpZJ4EVbIRjDsZz0FS0HgdefGIg-wQay34C_t14n2b_CUk6Z7vSq-3xzJALHZ9ALoe7FUaFUPNqw0hgHZsjDVar5Bf-0ZtvQxOEetV1cEoq7foWtqThB4Mfp84fLVEgIbvQyMcL_rZv-bALJXgfqxsmsbL-njQX7-BbcEKkHc00l-1n_n5axLC1O2IFMrUVgm5JAVFQNDm1DD1f09bRLghjM-zFLbhYpRONBCmYxUaqDbox4L8RKhjfDsrOzXrMKzHlFRyAfipBWRYgznFf-T9U2SetEWJuF87GZQ9VPuLd9SBVt4F35UzquIxchrCQZfrs_-sS8ZPLUU4cJwfAG0VURUrHlvD_8s5ZRalVmb_51LniSGTqKE9LpEMoGoUNFlwMRL6_ssURMhHOtfW2y5TQ31_9kZeYIeBfGsMWY7-DZLVL7rP8imT1yH1sPj90MTr9j8U9iMx06cpYebtAYpS6jUKJcpU'}
var sig = '3f63fa5c734863ade39b241c67d40bc413490a7f2a91cc4fcf125e7bc31a238ed5232fefb07ed18ae5547fe2e44e1f4d2c7bd21849726f4d3815cc616b5c9813713e2d04e6342458c0eda55bea275ddfc7f7a1e477157734d34ce010be97f2c184e6dadc9e666b1252b3af1362f9790304c1fd4c737db5c793f913b78eca4278403114544a27eb6d804f01b575831dcc51d9f104117d7c09ba93918244ba73a978cb8e43db38f9761c296bcb208a5e2fd4eef6d4ae87d159183bf08002f237fb38ea6763752080e47a333767e42c8315f17a75d0f509730c4658b7772c06042d5f5dcd2c277eaec12cbe30af88a2756b8a672a3465b70383d719e68f8df43a0d47b839c610db7ad64b5d39f4a20ebba228b08fb855b7437bb3ce98ab7fcfca1957a5a62a396c5a71b4e16b153c3c6643b0a0e3969614b8d5648139f005eb4eac5256b4a0d577c6a4ef1ff69112a2610b2d26add7c6abbd332ccf31426e0a2aff441f55753cf9766ddbf25f2f845b7ed076222fcc659456b0e9da6aadcb9ff1e274823d093ca522a048f3b3b6032a1d6653b309ed5b9901f1f1b5556ec72bfe7c4854be4beef3759a05d080f5e1908e62d774a3fe82d28bd73e32ea3bb7d7a31906217cfe3edac259979f217cb16664565cb95541308aee3eba4295f6c4aaac24b5d64f89843f72d9b39f8bde54c4519c4a87d254ff7b9ef5eafd91a7f9740c7a'


var n = new Buffer(user.n, 'base64');
var e = new Buffer(user.e, 'base64');

var publicKey = rsa.setPublicKey(new BigInteger(n.toString('hex'), 16), new BigInteger(e.toString('hex'), 16));
var signature = new Buffer(sig, 'hex');

// verify RSASSA-PSS signature
var pss = forge.pss.create({
  md: forge.md.sha256.create(),
  mgf: forge.mgf.mgf1.create(forge.md.sha256.create()),
  saltLength: 32
  // optionally pass 'prng' with a custom PRNG implementation
});
var md = forge.md.sha256.create();
md.update(datas, 'utf8');
publicKey.verify(md.digest().getBytes(), signature, pss);


// var n = new Buffer(user.n, 'base64');
// var e = new Buffer(user.e, 'base64');

// var publicKey = rsa.setPublicKey(new BigInteger(n.toString('hex'), 16), new BigInteger(e.toString('hex'), 16));

// var pss = forge.pss.create({
//   md: forge.md.sha256.create(),
//   mgf: forge.mgf.mgf1.create(forge.md.sha256.create()),
//   saltLength: 256
//   // optionally pass 'prng' with a custom PRNG implementation
// });
// var md = forge.md.sha256.create();
// md.update('3cd1ba381659fe0516b78afd03ff9e32ca20036bcd70f3243fe1e297d88cdd58', 'utf8');
// publicKey.verify(md.digest().getBytes(), signature, pss);



// LOG: '3cd1ba381659fe0516b78afd03ff9e32ca20036bcd70f3243fe1e297d88cdd58'
// LOG: Object{alg: 'RSA-OAEP-256', e: 'AQAB', ext: true, key_ops: ['encrypt', 'wrapKey'], kty: 'RSA', n: '0PjVDOimPsWjhkakQLVQGRjVbPAabvtPKLNppXgG2gtRGBBXOzZDp2VbSScbHKlzlZuDBtqrgSNZNdHeitRLv1VmyRUtSNyq6K3cYR5r-MYweSLNT-R2MbFkpuQ8dWBBYIlscKk4uz8-arf3Tg6DHjpHZDJygSutOgS0Teiwv_Et9dzye7PWnAznkMIZtfNdvuGPPhb1FdS3DSpZJ4EVbIRjDsZz0FS0HgdefGIg-wQay34C_t14n2b_CUk6Z7vSq-3xzJALHZ9ALoe7FUaFUPNqw0hgHZsjDVar5Bf-0ZtvQxOEetV1cEoq7foWtqThB4Mfp84fLVEgIbvQyMcL_rZv-bALJXgfqxsmsbL-njQX7-BbcEKkHc00l-1n_n5axLC1O2IFMrUVgm5JAVFQNDm1DD1f09bRLghjM-zFLbhYpRONBCmYxUaqDbox4L8RKhjfDsrOzXrMKzHlFRyAfipBWRYgznFf-T9U2SetEWJuF87GZQ9VPuLd9SBVt4F35UzquIxchrCQZfrs_-sS8ZPLUU4cJwfAG0VURUrHlvD_8s5ZRalVmb_51LniSGTqKE9LpEMoGoUNFlwMRL6_ssURMhHOtfW2y5TQ31_9kZeYIeBfGsMWY7-DZLVL7rP8imT1yH1sPj90MTr9j8U9iMx06cpYebtAYpS6jUKJcpU'}
// LOG: '2cea7881a1ab644891ff0eb7be9549d4511fa7b885259ac619beb9f16620dc78d9cdce0eb5b1c247c0ada3652316d2af1618efe6d91c4a87a34150e6d3f08612df7bf2eb6cf88a22d185d1e4460a05b7ef5a49fd5d14a740833968586195a0692bd87c7f32c3d8da4f2be7996bccb90bb45d57384e90dd8983cd7d03df736cc18fec93433889dcaa76c6d033567b06aa36d3f05f1578b439a9d5821b07c14099715297835eb355474a6518fafa29cf8779233b94dd55186f3c08d7a1a3d8f066d10bf61914dfd07b0f7b596c6458c4b53a3fb2f7107c8c07cc906a23e753107f1fc024d7c3872abc17707239294cd2b2d366a26dd74592c02346742fb048d613bfde36ea86e51a7e4bc456b07935cf93fd27f5669ebbe293257fd84b057f7d1124a2a7546d883f558751312e4a87f2dc3f7ce22e88de60f6d9739339ca4da90a1d4c4cd1e7b84e852bf4e7cf30923ca31d680648e75a13c0ef4221a74ff5267caceb0e7cc2c96c2a2a6dfbcd7465aa8084b3cac66ff84c39ab2e1a9e99fde401c972062e44e9ae2cb4c97cc7094b20d4cbb2c26c8b094e098165493c4fb7f449e6e2b0f1914aa8b28c085b2ccfb969565dfe7235a351e4a10f7b7c5928ff1fdc4b1ad096bceb7e4ee8b675a8092d7ff62d9dd28052298c88c2c02a0d075c41710d4b24190abfcfee4228240ca3a399495780aa36b08030b931501162f39acf3c'
